import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import type { Rama, Usuario } from '@/types/domain'
import type { Ambito } from '@/lib/auth/permisos'

/**
 * Acceso a datos de `rama`.
 * Toda consulta lleva el filtro de alcance del rol en el SQL: si el rol no
 * alcanza la fila, la base de datos no la devuelve.
 */

interface FilaRama extends RowDataPacket {
  id: number
  nombre: string
  descripcion: string | null
  lider_id: number | null
  lider_nombre?: string | null
  activa: number | boolean
  creado_en: Date | string
}

/** Rama con el nombre de su líder, para mostrar en las listas. */
export interface RamaConLider extends Rama {
  nombreLider: string | null
}

const COLUMNAS = 'r.id, r.nombre, r.descripcion, r.lider_id, r.activa, r.creado_en'

function aRama(fila: FilaRama): Rama {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    liderId: fila.lider_id,
    activa: Boolean(fila.activa),
    creadoEn:
      fila.creado_en instanceof Date ? fila.creado_en.toISOString() : String(fila.creado_en),
  }
}

/**
 * Restricción de alcance según el rol de la cuenta.
 * - Organización → todo
 * - Rama         → solo su rama
 * - Célula       → solo la rama de su célula
 */
function alcance(
  identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>,
  alias = 'r',
): { sql: string; parametros: unknown[] } {
  if (identidad.alcance === 'ORGANIZACION') return { sql: '1 = 1', parametros: [] }
  if (identidad.alcance === 'RAMA') {
    if (identidad.ramaId == null) return { sql: '1 = 0', parametros: [] }
    return { sql: `${alias}.id = ?`, parametros: [identidad.ramaId] }
  }
  if (identidad.celulaId == null) return { sql: '1 = 0', parametros: [] }
  return {
    sql: `${alias}.id = (SELECT rama_id FROM celula WHERE id = ?)`,
    parametros: [identidad.celulaId],
  }
}

/** Ramas visibles para la identidad, con el nombre de su líder si tiene. */
export async function listarRamas(
  identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>,
  soloActivas = true,
): Promise<RamaConLider[]> {
  const limite = { sql: soloActivas ? 'AND r.activa = 1' : '', parametros: [] as unknown[] }
  const filtro = alcance(identidad)
  const filas = await consultar<FilaRama>(
    `SELECT ${COLUMNAS}, u.nombre AS lider_nombre
       FROM rama r
       LEFT JOIN usuario u ON u.id = r.lider_id
      WHERE ${filtro.sql} ${limite.sql}
      ORDER BY r.nombre`,
    [...filtro.parametros, ...limite.parametros],
  )
  return filas.map((fila) => ({ ...aRama(fila), nombreLider: fila.lider_nombre ?? null }))
}

/** Rama por id, respetando el alcance. */
export async function buscarRama(
  id: number,
  identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>,
): Promise<Rama | null> {
  const filtro = alcance(identidad)
  const fila = await consultarUno<FilaRama>(
    `SELECT ${COLUMNAS} FROM rama r WHERE r.id = ? AND ${filtro.sql}`,
    [id, ...filtro.parametros],
  )
  return fila ? aRama(fila) : null
}

/** Nombre del líder de la rama, para la ficha. */
export async function nombreLiderDeRama(id: number): Promise<string | null> {
  const fila = await consultarUno<{ nombre: string }>(
    `SELECT u.nombre FROM rama r LEFT JOIN usuario u ON u.id = r.lider_id WHERE r.id = ?`,
    [id],
  )
  return fila?.nombre ?? null
}

export async function crearRama(datos: {
  nombre: string
  descripcion: string | null
}): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO rama (nombre, descripcion) VALUES (?, ?)`,
    [datos.nombre, datos.descripcion],
  )
  return resultado.insertId
}

export async function actualizarRama(
  id: number,
  datos: { nombre: string; descripcion: string | null; liderId: number | null; activa: boolean },
): Promise<void> {
  await ejecutar(
    `UPDATE rama SET nombre = ?, descripcion = ?, lider_id = ?, activa = ? WHERE id = ?`,
    [datos.nombre, datos.descripcion, datos.liderId, datos.activa ? 1 : 0, id],
  )
}

/** Desactivación en vez de borrado: se conserva el historial. */
export async function desactivarRama(id: number): Promise<void> {
  await ejecutar(`UPDATE rama SET activa = 0 WHERE id = ?`, [id])
}

/** Células que existen dentro de una rama (para validar permisos de célula). */
export async function ramaDeCelula(celulaId: number): Promise<number | null> {
  const fila = await consultarUno<{ rama_id: number }>(`SELECT rama_id FROM celula WHERE id = ?`, [
    celulaId,
  ])
  return fila?.rama_id ?? null
}

/** Comprueba que el objeto (rama) caiga dentro del territorio del usuario. */
export function ambitoDeRama(rama: Rama): Ambito {
  return { ramaId: rama.id }
}
