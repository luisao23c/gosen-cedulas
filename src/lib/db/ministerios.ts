import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import { filtroMinisterio, type IdentidadMinisterio } from '@/lib/db/alcance'
import type { Ministerio } from '@/types/domain'

/**
 * Acceso a datos de `ministerio`.
 * Un ministerio es un área de servicio (cámaras, alabanza, sonido…) y NO cuelga
 * de una rama: cruza las ramas. Por eso el alcance es `MINISTERIO`, aparte.
 */

interface FilaMinisterio extends RowDataPacket {
  id: number
  nombre: string
  descripcion: string | null
  encargado_id: number | null
  activo: number | boolean
  creado_en: Date | string
  encargado_nombre?: string | null
}

const COLUMNAS = 'm.id, m.nombre, m.descripcion, m.encargado_id, m.activo, m.creado_en'

function aMinisterio(fila: FilaMinisterio): Ministerio {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    encargadoId: fila.encargado_id,
    activo: Boolean(fila.activo),
    creadoEn:
      fila.creado_en instanceof Date ? fila.creado_en.toISOString() : String(fila.creado_en),
  }
}

/** Ministerio con el nombre de quien lo lleva, para los listados. */
export interface MinisterioConEncargado extends Ministerio {
  nombreEncargado: string | null
}

/** Ministerios visibles para la cuenta (todos, si es de organización). */
export async function listarMinisterios(
  identidad: IdentidadMinisterio,
  opciones: { soloActivos?: boolean } = {},
): Promise<MinisterioConEncargado[]> {
  const filtro = filtroMinisterio(identidad, 'm.id')
  const condiciones = [filtro.sql]
  if (opciones.soloActivos !== false) condiciones.push('m.activo = 1')

  const filas = await consultar<FilaMinisterio>(
    `SELECT ${COLUMNAS}, u.nombre AS encargado_nombre
       FROM ministerio m
       LEFT JOIN usuario u ON u.id = m.encargado_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY m.nombre`,
    filtro.parametros,
  )
  return filas.map((fila) => ({ ...aMinisterio(fila), nombreEncargado: fila.encargado_nombre ?? null }))
}

/** Ministerio por id respetando el alcance. */
export async function buscarMinisterio(
  id: number,
  identidad: IdentidadMinisterio,
): Promise<Ministerio | null> {
  const filtro = filtroMinisterio(identidad, 'm.id')
  const fila = await consultarUno<FilaMinisterio>(
    `SELECT ${COLUMNAS} FROM ministerio m WHERE m.id = ? AND ${filtro.sql}`,
    [id, ...filtro.parametros],
  )
  return fila ? aMinisterio(fila) : null
}

/** Ministerio por id SIN filtrar alcance: para saber a cuál pertenece algo. */
export async function ministerioDeRegistro(
  id: number,
): Promise<{ id: number; nombre: string } | null> {
  const fila = await consultarUno<{ id: number; nombre: string }>(
    `SELECT id, nombre FROM ministerio WHERE id = ?`,
    [id],
  )
  return fila ?? null
}

export async function crearMinisterio(datos: {
  nombre: string
  descripcion: string | null
}): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO ministerio (nombre, descripcion) VALUES (?, ?)`,
    [datos.nombre, datos.descripcion],
  )
  return resultado.insertId
}

export async function actualizarMinisterio(
  id: number,
  datos: {
    nombre: string
    descripcion: string | null
    encargadoId: number | null
    activo: boolean
  },
): Promise<void> {
  await ejecutar(
    `UPDATE ministerio SET nombre = ?, descripcion = ?, encargado_id = ?, activo = ? WHERE id = ?`,
    [datos.nombre, datos.descripcion, datos.encargadoId, datos.activo ? 1 : 0, id],
  )
}

/** Desactivación en vez de borrado: se conserva el historial de equipos y eventos. */
export async function desactivarMinisterio(id: number): Promise<void> {
  await ejecutar(`UPDATE ministerio SET activo = 0 WHERE id = ?`, [id])
}

/** Cuenta que pertenece a un ministerio (las de organización NO cuentan como miembros). */
export interface MiembroMinisterio {
  id: number
  nombre: string
  email: string
  rolNombre: string
  ministerioId: number
}

/**
 * Integrantes de UN ministerio: las cuentas activas cuyo `ministerio_id` es ese.
 * Es la única lista de la que sale «a quién se le presta un equipo»: el equipo es del
 * ministerio, así que solo lo lleva alguien del ministerio (ni siquiera la organización).
 */
export async function listarMiembros(ministerioId: number): Promise<MiembroMinisterio[]> {
  const filas = await consultar<
    RowDataPacket & { id: number; nombre: string; email: string; rol_nombre: string }
  >(
    `SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.activo = 1 AND u.ministerio_id = ?
      ORDER BY u.nombre`,
    [ministerioId],
  )
  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    rolNombre: fila.rol_nombre,
    ministerioId,
  }))
}

/** ¿Esta cuenta activa es miembro de ese ministerio? (para validar lo que llega del cliente) */
export async function esMiembroDeMinisterio(
  usuarioId: number,
  ministerioId: number,
): Promise<boolean> {
  const fila = await consultarUno<RowDataPacket>(
    `SELECT 1 AS si FROM usuario WHERE id = ? AND ministerio_id = ? AND activo = 1 LIMIT 1`,
    [usuarioId, ministerioId],
  )
  return fila != null
}
