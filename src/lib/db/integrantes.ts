import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import type { Integrante, SituacionIntegrante, Usuario } from '@/types/domain'

/**
 * Acceso a datos de `integrante`.
 * Igual que ramas y células: la condición de alcance viaja DENTRO del SQL.
 * Un integrante cuelga de una célula, que cuelga de una rama, así que la
 * restricción se resuelve con un JOIN (alias `c` = célula).
 */

interface FilaIntegrante extends RowDataPacket {
  id: number
  celula_id: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  fecha_nacimiento: Date | string | null
  latitud: string | number | null
  longitud: string | number | null
  direccion: string | null
  origen_ciudad: string | null
  origen_estado: string | null
  hizo_encuentro: number | boolean
  fecha_encuentro: Date | string | null
  bautizado: number | boolean
  fecha_bautizo: Date | string | null
  situacion: SituacionIntegrante
  telefono: string | null
  notas: string | null
  creado_en: Date | string
  actualizado_en: Date | string | null
  celula_nombre?: string | null
  rama_id?: number | null
}

const COLUMNAS = `i.id, i.celula_id, i.nombre, i.apellido_paterno, i.apellido_materno,
  i.fecha_nacimiento, i.latitud, i.longitud, i.direccion,
  i.origen_ciudad, i.origen_estado, i.hizo_encuentro, i.fecha_encuentro,
  i.bautizado, i.fecha_bautizo, i.situacion, i.telefono, i.notas,
  i.creado_en, i.actualizado_en`

const DESDE = 'FROM integrante i JOIN celula c ON c.id = i.celula_id'

/** Las fechas de MySQL llegan como Date (o texto): a ISO corto para el formulario. */
function aFecha(valor: Date | string | null): string | null {
  if (valor == null) return null
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return String(valor).slice(0, 10)
}

function aInstante(valor: Date | string | null): string | null {
  if (valor == null) return null
  return valor instanceof Date ? valor.toISOString() : String(valor)
}

/** MySQL entrega los DECIMAL como texto: se convierten al leer. */
function aNumero(valor: string | number | null): number | null {
  if (valor == null) return null
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function aIntegrante(fila: FilaIntegrante): IntegranteConCelula {
  return {
    id: fila.id,
    celulaId: fila.celula_id,
    nombre: fila.nombre,
    apellidoPaterno: fila.apellido_paterno,
    apellidoMaterno: fila.apellido_materno,
    fechaNacimiento: aFecha(fila.fecha_nacimiento),
    ubicacion: {
      latitud: aNumero(fila.latitud),
      longitud: aNumero(fila.longitud),
      direccion: fila.direccion,
    },
    origen: { ciudad: fila.origen_ciudad, estado: fila.origen_estado },
    hizoEncuentro: Boolean(fila.hizo_encuentro),
    fechaEncuentro: aFecha(fila.fecha_encuentro),
    bautizado: Boolean(fila.bautizado),
    fechaBautizo: aFecha(fila.fecha_bautizo),
    situacion: fila.situacion,
    telefono: fila.telefono,
    notas: fila.notas,
    creadoEn: aInstante(fila.creado_en) ?? '',
    actualizadoEn: aInstante(fila.actualizado_en),
    nombreCelula: fila.celula_nombre ?? null,
    ramaId: fila.rama_id ?? null,
  }
}

/** Integrante con la célula y la rama a las que pertenece (para el ámbito de permisos). */
export interface IntegranteConCelula extends Integrante {
  nombreCelula: string | null
  ramaId: number | null
}

/** Restricción de alcance: el integrante se filtra por la rama de su célula. */
function alcance(identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>): {
  sql: string
  parametros: unknown[]
} {
  if (identidad.alcance === 'ORGANIZACION') return { sql: '1 = 1', parametros: [] }
  if (identidad.alcance === 'RAMA') {
    if (identidad.ramaId == null) return { sql: '1 = 0', parametros: [] }
    return { sql: 'c.rama_id = ?', parametros: [identidad.ramaId] }
  }
  if (identidad.celulaId == null) return { sql: '1 = 0', parametros: [] }
  return { sql: 'c.id = ?', parametros: [identidad.celulaId] }
}

/** Integrantes visibles; opcionalmente los de una célula o situación concretas. */
export async function listarIntegrantes(
  identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>,
  opciones: { celulaId?: number; situacion?: SituacionIntegrante } = {},
): Promise<IntegranteConCelula[]> {
  const filtro = alcance(identidad)
  const condiciones = [filtro.sql]
  const parametros: unknown[] = [...filtro.parametros]

  if (opciones.celulaId != null) {
    condiciones.push('i.celula_id = ?')
    parametros.push(opciones.celulaId)
  }
  if (opciones.situacion != null) {
    condiciones.push('i.situacion = ?')
    parametros.push(opciones.situacion)
  }

  const filas = await consultar<FilaIntegrante>(
    `SELECT ${COLUMNAS}, c.nombre AS celula_nombre, c.rama_id
       ${DESDE}
      WHERE ${condiciones.join(' AND ')}
      ORDER BY i.apellido_paterno, i.apellido_materno, i.nombre`,
    parametros,
  )
  return filas.map(aIntegrante)
}

/**
 * Quienes pueden celebrar: integrantes con fecha de nacimiento y que siguen
 * dentro (activos o visitantes). Los inactivos y egresados no entran al
 * reporte de cumpleaños.
 *
 * Se traen todos los de la ventana del rol y el filtro por días se hace en
 * `lib/cumpleanos.ts`: la ventana cruza el fin de año y ese cálculo es de
 * fechas, no de SQL. El alcance, que sí es seguridad, va dentro de la consulta.
 */
export async function listarConFechaNacimiento(
  identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>,
): Promise<IntegranteConCelula[]> {
  const filtro = alcance(identidad)
  const filas = await consultar<FilaIntegrante>(
    `SELECT ${COLUMNAS}, c.nombre AS celula_nombre, c.rama_id
       ${DESDE}
      WHERE ${filtro.sql}
        AND i.fecha_nacimiento IS NOT NULL
        AND i.situacion IN ('ACTIVO', 'VISITANTE')
      ORDER BY MONTH(i.fecha_nacimiento), DAY(i.fecha_nacimiento)`,
    filtro.parametros,
  )
  return filas.map(aIntegrante)
}

/** Integrante por id respetando el alcance. */
export async function buscarIntegrante(
  id: number,
  identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>,
): Promise<IntegranteConCelula | null> {
  const filtro = alcance(identidad)
  const fila = await consultarUno<FilaIntegrante>(
    `SELECT ${COLUMNAS}, c.nombre AS celula_nombre, c.rama_id
       ${DESDE} WHERE i.id = ? AND ${filtro.sql}`,
    [id, ...filtro.parametros],
  )
  return fila ? aIntegrante(fila) : null
}

/** Célula a la que pertenece un integrante. Para exigir permiso con el ámbito real. */
export async function celulaDeIntegrante(id: number): Promise<number | null> {
  const fila = await consultarUno<{ celula_id: number }>(
    `SELECT celula_id FROM integrante WHERE id = ?`,
    [id],
  )
  return fila?.celula_id ?? null
}

/** Datos completos de un integrante, ya validados y normalizados. */
export interface DatosIntegrante {
  celulaId: number
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  fechaNacimiento: string | null
  latitud: number | null
  longitud: number | null
  direccion: string | null
  origenCiudad: string | null
  origenEstado: string | null
  hizoEncuentro: boolean
  fechaEncuentro: string | null
  bautizado: boolean
  fechaBautizo: string | null
  situacion: SituacionIntegrante
  telefono: string | null
  notas: string | null
}

export async function crearIntegrante(datos: DatosIntegrante): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO integrante
       (celula_id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
        latitud, longitud, direccion, origen_ciudad, origen_estado,
        hizo_encuentro, fecha_encuentro, bautizado, fecha_bautizo, situacion,
        telefono, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.celulaId,
      datos.nombre,
      datos.apellidoPaterno,
      datos.apellidoMaterno,
      datos.fechaNacimiento,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.origenCiudad,
      datos.origenEstado,
      datos.hizoEncuentro ? 1 : 0,
      datos.fechaEncuentro,
      datos.bautizado ? 1 : 0,
      datos.fechaBautizo,
      datos.situacion,
      datos.telefono,
      datos.notas,
    ],
  )
  return resultado.insertId
}

/**
 * Actualiza el integrante. La célula NO se toca a propósito: un integrante no
 * cambia de célula (regla de negocio 1 de MEMORY §4), por eso no se pide.
 */
export async function actualizarIntegrante(
  id: number,
  datos: Omit<DatosIntegrante, 'celulaId'>,
): Promise<void> {
  await ejecutar(
    `UPDATE integrante SET
       nombre = ?, apellido_paterno = ?, apellido_materno = ?, fecha_nacimiento = ?,
       latitud = ?, longitud = ?, direccion = ?,
       origen_ciudad = ?, origen_estado = ?, hizo_encuentro = ?, fecha_encuentro = ?,
       bautizado = ?, fecha_bautizo = ?, situacion = ?, telefono = ?, notas = ?
     WHERE id = ?`,
    [
      datos.nombre,
      datos.apellidoPaterno,
      datos.apellidoMaterno,
      datos.fechaNacimiento,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.origenCiudad,
      datos.origenEstado,
      datos.hizoEncuentro ? 1 : 0,
      datos.fechaEncuentro,
      datos.bautizado ? 1 : 0,
      datos.fechaBautizo,
      datos.situacion,
      datos.telefono,
      datos.notas,
      id,
    ],
  )
}

/**
 * Baja del integrante: se marca INACTIVO en vez de borrarlo, para conservar el
 * historial de asistencia (regla de negocio 5 de MEMORY §4).
 */
export async function darDeBajaIntegrante(id: number): Promise<void> {
  await ejecutar(`UPDATE integrante SET situacion = 'INACTIVO' WHERE id = ?`, [id])
}
