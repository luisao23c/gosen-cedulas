import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import { filtroMinisterio, type IdentidadMinisterio } from '@/lib/db/alcance'
import type { Equipo, EstatusEquipo } from '@/types/domain'

/**
 * Acceso a datos de `equipo` (el inventario de cada ministerio).
 *
 * `prestado` no es una columna: se deduce del historial: hay préstamo abierto
 * mientras `devuelto_en` sea NULL. Así no hay dos fuentes de verdad que se
 * puedan contradecir.
 */

interface FilaEquipo extends RowDataPacket {
  id: number
  ministerio_id: number
  nombre: string
  descripcion: string | null
  estatus: EstatusEquipo
  creado_en: Date | string
  prestado: number | boolean
  ministerio_nombre?: string | null
  responsable_nombre?: string | null
}

const COLUMNAS = `e.id, e.ministerio_id, e.nombre, e.descripcion, e.estatus, e.creado_en,
  (p.id IS NOT NULL) AS prestado`

const DESDE = `FROM equipo e
  LEFT JOIN prestamo p ON p.equipo_id = e.id AND p.devuelto_en IS NULL
  LEFT JOIN usuario u ON u.id = p.responsable_id`

function aEquipo(fila: FilaEquipo): Equipo {
  return {
    id: fila.id,
    ministerioId: fila.ministerio_id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    estatus: fila.estatus,
    prestado: Boolean(fila.prestado),
    creadoEn:
      fila.creado_en instanceof Date ? fila.creado_en.toISOString() : String(fila.creado_en),
  }
}

/** Equipo con datos de su ministerio y de quién lo trae ahora, para listados. */
export interface EquipoConContexto extends Equipo {
  nombreMinisterio: string | null
  nombreResponsable: string | null
}

/** Equipos visibles; se pueden limitar a un ministerio concreto. */
export async function listarEquipos(
  identidad: IdentidadMinisterio,
  opciones: { ministerioId?: number; incluirBaja?: boolean } = {},
): Promise<EquipoConContexto[]> {
  const filtro = filtroMinisterio(identidad, 'e.ministerio_id')
  const condiciones = [filtro.sql]
  const parametros: unknown[] = [...filtro.parametros]

  if (opciones.ministerioId != null) {
    condiciones.push('e.ministerio_id = ?')
    parametros.push(opciones.ministerioId)
  }
  if (!opciones.incluirBaja) condiciones.push(`e.estatus <> 'BAJA'`)

  const filas = await consultar<FilaEquipo>(
    `SELECT ${COLUMNAS}, m.nombre AS ministerio_nombre, u.nombre AS responsable_nombre
       ${DESDE}
       JOIN ministerio m ON m.id = e.ministerio_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY m.nombre, e.nombre`,
    parametros,
  )

  return filas.map((fila) => ({
    ...aEquipo(fila),
    nombreMinisterio: fila.ministerio_nombre ?? null,
    nombreResponsable: fila.responsable_nombre ?? null,
  }))
}

/** Equipo por id respetando el alcance. */
export async function buscarEquipo(id: number, identidad: IdentidadMinisterio): Promise<Equipo | null> {
  const filtro = filtroMinisterio(identidad, 'e.ministerio_id')
  const fila = await consultarUno<FilaEquipo>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE e.id = ? AND ${filtro.sql}`,
    [id, ...filtro.parametros],
  )
  return fila ? aEquipo(fila) : null
}

/** Equipo por id SIN filtrar alcance: para saber a qué ministerio pertenece. */
export async function equipoConMinisterio(
  id: number,
): Promise<{ id: number; ministerioId: number; nombre: string; estatus: EstatusEquipo } | null> {
  const fila = await consultarUno<{
    id: number
    ministerio_id: number
    nombre: string
    estatus: EstatusEquipo
  }>(`SELECT id, ministerio_id, nombre, estatus FROM equipo WHERE id = ?`, [id])
  return fila
    ? { id: fila.id, ministerioId: fila.ministerio_id, nombre: fila.nombre, estatus: fila.estatus }
    : null
}

export async function crearEquipo(datos: {
  ministerioId: number
  nombre: string
  descripcion: string | null
}): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO equipo (ministerio_id, nombre, descripcion) VALUES (?, ?, ?)`,
    [datos.ministerioId, datos.nombre, datos.descripcion],
  )
  return resultado.insertId
}

export async function actualizarEquipo(
  id: number,
  datos: { nombre: string; descripcion: string | null; estatus: EstatusEquipo },
): Promise<void> {
  await ejecutar(
    `UPDATE equipo SET nombre = ?, descripcion = ?, estatus = ? WHERE id = ?`,
    [datos.nombre, datos.descripcion, datos.estatus, id],
  )
}

/** Cambia solo el estatus (dar de baja, mandar a mantenimiento, reactivar). */
export async function cambiarEstatusEquipo(id: number, estatus: EstatusEquipo): Promise<void> {
  await ejecutar(`UPDATE equipo SET estatus = ? WHERE id = ?`, [estatus, id])
}

/**
 * Marca el equipo como prestado o disponible según su historial.
 * Se llama al abrir y al cerrar un préstamo para que el estatus administrativo
 * no se quede mintiendo (salvo mantenimiento/baja, que los decide una persona).
 */
export async function sincronizarEstatusEquipo(equipoId: number): Promise<void> {
  await ejecutar(
    `UPDATE equipo
        SET estatus = CASE
              WHEN estatus = 'BAJA' THEN 'BAJA'
              WHEN (SELECT COUNT(*) FROM prestamo p
                     WHERE p.equipo_id = equipo.id AND p.devuelto_en IS NULL) > 0 THEN 'PRESTADO'
              WHEN estatus = 'PRESTADO' THEN 'DISPONIBLE'
              ELSE estatus
            END
      WHERE id = ?`,
    [equipoId],
  )
}
