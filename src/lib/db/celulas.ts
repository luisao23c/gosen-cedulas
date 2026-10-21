import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import type { Celula, Usuario } from '@/types/domain'

/**
 * Acceso a datos de `celula`. Mismo criterio que ramas: la condición de
 * alcance viaja DENTRO del SQL.
 */

interface FilaCelula extends RowDataPacket {
  id: number
  rama_id: number
  nombre: string
  lider_id: number | null
  dia_semana: number | null
  hora: string | Date | null
  latitud: string | number | null
  longitud: string | number | null
  direccion: string | null
  activa: number | boolean
  creado_en: Date | string
  rama_nombre?: string | null
}

const COLUMNAS =
  'c.id, c.rama_id, c.nombre, c.lider_id, c.dia_semana, c.hora, c.latitud, c.longitud, c.direccion, c.activa, c.creado_en'

/** MySQL entrega los DECIMAL como texto: se convierten al leer. */
function aNumero(valor: string | number | null): number | null {
  if (valor == null) return null
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function aHora(valor: string | Date | null): string | null {
  if (valor == null) return null
  if (valor instanceof Date) {
    return `${String(valor.getUTCHours()).padStart(2, '0')}:${String(valor.getUTCMinutes()).padStart(2, '0')}`
  }
  return String(valor).slice(0, 5)
}

function aCelula(fila: FilaCelula): Celula {
  return {
    id: fila.id,
    ramaId: fila.rama_id,
    nombre: fila.nombre,
    liderId: fila.lider_id,
    diaSemana: fila.dia_semana,
    hora: aHora(fila.hora),
    ubicacion: {
      latitud: aNumero(fila.latitud),
      longitud: aNumero(fila.longitud),
      direccion: fila.direccion,
    },
    activa: Boolean(fila.activa),
    creadoEn:
      fila.creado_en instanceof Date ? fila.creado_en.toISOString() : String(fila.creado_en),
  }
}

/** Célula con el nombre de su rama, para pintar listados sin consultas extra. */
export interface CelulaConRama extends Celula {
  nombreRama: string | null
}

type IdentidadAlcance = Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>

/** Restricción de alcance para consultas de célula. */
function alcance(identidad: IdentidadAlcance): { sql: string; parametros: unknown[] } {
  if (identidad.alcance === 'ORGANIZACION') return { sql: '1 = 1', parametros: [] }
  if (identidad.alcance === 'RAMA') {
    if (identidad.ramaId == null) return { sql: '1 = 0', parametros: [] }
    return { sql: 'c.rama_id = ?', parametros: [identidad.ramaId] }
  }
  if (identidad.celulaId == null) return { sql: '1 = 0', parametros: [] }
  return { sql: 'c.id = ?', parametros: [identidad.celulaId] }
}

/** Células visibles; opcionalmente limitadas a una rama concreta. */
export async function listarCelulas(
  identidad: IdentidadAlcance,
  opciones: { ramaId?: number; soloActivas?: boolean } = {},
): Promise<CelulaConRama[]> {
  const filtro = alcance(identidad)
  const condiciones = [filtro.sql]
  const parametros: unknown[] = [...filtro.parametros]

  if (opciones.ramaId != null) {
    condiciones.push('c.rama_id = ?')
    parametros.push(opciones.ramaId)
  }
  if (opciones.soloActivas !== false) condiciones.push('c.activa = 1')

  const filas = await consultar<FilaCelula>(
    `SELECT ${COLUMNAS}, r.nombre AS rama_nombre
       FROM celula c
       JOIN rama r ON r.id = c.rama_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY r.nombre, c.nombre`,
    parametros,
  )
  return filas.map((fila) => ({ ...aCelula(fila), nombreRama: fila.rama_nombre ?? null }))
}

/** Célula por id respetando el alcance. */
export async function buscarCelula(id: number, identidad: IdentidadAlcance): Promise<Celula | null> {
  const filtro = alcance(identidad)
  const fila = await consultarUno<FilaCelula>(
    `SELECT ${COLUMNAS} FROM celula c WHERE c.id = ? AND ${filtro.sql}`,
    [id, ...filtro.parametros],
  )
  return fila ? aCelula(fila) : null
}

export async function crearCelula(datos: {
  ramaId: number
  nombre: string
  diaSemana: number | null
  hora: string | null
  latitud: number | null
  longitud: number | null
  direccion: string | null
}): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO celula (rama_id, nombre, dia_semana, hora, latitud, longitud, direccion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.ramaId,
      datos.nombre,
      datos.diaSemana,
      datos.hora,
      datos.latitud,
      datos.longitud,
      datos.direccion,
    ],
  )
  return resultado.insertId
}

export async function actualizarCelula(
  id: number,
  datos: {
    nombre: string
    liderId: number | null
    diaSemana: number | null
    hora: string | null
    latitud: number | null
    longitud: number | null
    direccion: string | null
    activa: boolean
  },
): Promise<void> {
  await ejecutar(
    `UPDATE celula SET nombre = ?, lider_id = ?, dia_semana = ?, hora = ?, latitud = ?, longitud = ?, direccion = ?, activa = ?
      WHERE id = ?`,
    [
      datos.nombre,
      datos.liderId,
      datos.diaSemana,
      datos.hora,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.activa ? 1 : 0,
      id,
    ],
  )
}

/** Desactivación en vez de borrado (se conserva el historial). */
export async function desactivarCelula(id: number): Promise<void> {
  await ejecutar(`UPDATE celula SET activa = 0 WHERE id = ?`, [id])
}
