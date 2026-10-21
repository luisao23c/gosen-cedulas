import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import { filtroMinisterio, type IdentidadMinisterio } from '@/lib/db/alcance'
import type { ConservacionEquipo, Prestamo } from '@/types/domain'
import { aInstante } from '@/lib/servicio'

/**
 * Acceso a datos de `prestamo`.
 *
 * Un préstamo abierto es el que tiene `devuelto_en` NULL: mientras siga
 * abierto, el equipo está fuera con esa persona. Al cerrarlo se guarda qué día
 * y a qué hora volvió y en qué estado lo recibió quien lo recibió.
 *
 * Las horas se escriben como TEXTO de reloj de pared (ver lib/servicio.ts): al
 * enviar un `Date` de JavaScript, mysql2 lo desplaza a UTC y «09:32» se
 * guardaría como «15:32».
 */

interface FilaPrestamo extends RowDataPacket {
  id: number
  equipo_id: number
  ministerio_id: number
  responsable_id: number
  asignado_a_id: number | null
  evento_id: number | null
  prestado_en: Date | string
  recogido_en: Date | string | null
  devolucion_avisada_en: Date | string | null
  estado_devolucion_avisado: ConservacionEquipo | null
  devuelto_en: Date | string | null
  estado_entrega: ConservacionEquipo
  estado_devolucion: ConservacionEquipo | null
  notas: string | null
  registrado_por_id: number | null
  equipo_nombre?: string | null
  responsable_nombre?: string | null
  asignado_nombre?: string | null
  ministerio_nombre?: string | null
  evento_nombre?: string | null
}

const COLUMNAS = `p.id, p.equipo_id, e.ministerio_id, p.responsable_id, p.asignado_a_id, p.evento_id,
  p.prestado_en, p.recogido_en, p.devolucion_avisada_en, p.estado_devolucion_avisado, p.devuelto_en, p.estado_entrega, p.estado_devolucion, p.notas, p.registrado_por_id`

const DESDE = `FROM prestamo p
  JOIN equipo e ON e.id = p.equipo_id
  LEFT JOIN usuario ru ON ru.id = p.responsable_id
  LEFT JOIN usuario au ON au.id = p.asignado_a_id`

function aPrestamo(fila: FilaPrestamo): Prestamo {
  return {
    id: fila.id,
    equipoId: fila.equipo_id,
    ministerioId: fila.ministerio_id,
    responsableId: fila.responsable_id,
    asignadoAId: fila.asignado_a_id,
    eventoId: fila.evento_id,
    prestadoEn: aInstante(fila.prestado_en) ?? '',
    recogidoEn: aInstante(fila.recogido_en),
    devolucionAvisadaEn: aInstante(fila.devolucion_avisada_en),
    estadoDevolucionAvisado: fila.estado_devolucion_avisado,
    devueltoEn: aInstante(fila.devuelto_en),
    estadoEntrega: fila.estado_entrega,
    estadoDevolucion: fila.estado_devolucion,
    notas: fila.notas,
    registradoPorId: fila.registrado_por_id,
    nombreEquipo: fila.equipo_nombre ?? null,
    nombreResponsable: fila.responsable_nombre ?? null,
    nombreAsignado: fila.asignado_nombre ?? null,
    nombreMinisterio: fila.ministerio_nombre ?? null,
    nombreEvento: fila.evento_nombre ?? null,
  }
}

/** Préstamos visibles; por defecto, los que siguen abiertos. */
export async function listarPrestamos(
  identidad: IdentidadMinisterio,
  opciones: {
    soloAbiertos?: boolean
    equipoId?: number
    usuarioId?: number
    eventoId?: number
  } = {},
): Promise<Prestamo[]> {
  const filtro = filtroMinisterio(identidad, 'e.ministerio_id')
  const condiciones = [filtro.sql]
  const parametros: unknown[] = [...filtro.parametros]

  if (opciones.soloAbiertos !== false) condiciones.push('p.devuelto_en IS NULL')
  if (opciones.equipoId != null) {
    condiciones.push('p.equipo_id = ?')
    parametros.push(opciones.equipoId)
  }
  if (opciones.eventoId != null) {
    condiciones.push('p.evento_id = ?')
    parametros.push(opciones.eventoId)
  }
  if (opciones.usuarioId != null) {
    // Los que trae esa persona o los que tiene asignados
    condiciones.push('(p.responsable_id = ? OR p.asignado_a_id = ?)')
    parametros.push(opciones.usuarioId, opciones.usuarioId)
  }

  const filas = await consultar<FilaPrestamo>(
    `SELECT ${COLUMNAS}, e.nombre AS equipo_nombre, m.nombre AS ministerio_nombre,
            ru.nombre AS responsable_nombre, au.nombre AS asignado_nombre,
            ev.nombre AS evento_nombre
       ${DESDE}
       JOIN ministerio m ON m.id = e.ministerio_id
       LEFT JOIN evento ev ON ev.id = p.evento_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY p.devuelto_en IS NOT NULL, p.prestado_en DESC`,
    parametros,
  )
  return filas.map(aPrestamo)
}

/** Préstamo por id respetando el alcance (el ministerio lo aporta el equipo). */
export async function buscarPrestamo(
  id: number,
  identidad: IdentidadMinisterio,
): Promise<Prestamo | null> {
  const filtro = filtroMinisterio(identidad, 'e.ministerio_id')
  const fila = await consultarUno<FilaPrestamo>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE p.id = ? AND ${filtro.sql}`,
    [id, ...filtro.parametros],
  )
  return fila ? aPrestamo(fila) : null
}

/**
 * Préstamo por id SIN filtrar alcance: para saber a qué ministerio pertenece
 * antes de comprobar el permiso (el ámbito tiene que salir de los datos, no
 * del id que manda el cliente).
 */
export async function prestamoDeRegistro(id: number): Promise<{
  id: number
  equipoId: number
  ministerioId: number
  responsableId: number
  asignadoAId: number | null
  recogidoEn: string | null
  devolucionAvisadaEn: string | null
  devueltoEn: string | null
} | null> {
  const fila = await consultarUno<FilaPrestamo>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE p.id = ? LIMIT 1`,
    [id],
  )
  return fila
    ? {
        id: fila.id,
        equipoId: fila.equipo_id,
        ministerioId: fila.ministerio_id,
        responsableId: fila.responsable_id,
        asignadoAId: fila.asignado_a_id,
        recogidoEn: aInstante(fila.recogido_en),
        devolucionAvisadaEn: aInstante(fila.devolucion_avisada_en),
        devueltoEn: aInstante(fila.devuelto_en),
      }
    : null
}

/** Préstamo abierto de un equipo, si lo hay (para no prestar dos veces lo mismo). */
export async function prestamoAbiertoDe(equipoId: number): Promise<Prestamo | null> {
  const fila = await consultarUno<FilaPrestamo>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE p.equipo_id = ? AND p.devuelto_en IS NULL LIMIT 1`,
    [equipoId],
  )
  return fila ? aPrestamo(fila) : null
}

/** Abre un préstamo: el equipo sale con alguien (una cuenta puede traer varios). */
export async function abrirPrestamo(datos: {
  equipoId: number
  responsableId: number
  asignadoAId: number | null
  eventoId: number | null
  estadoEntrega: ConservacionEquipo
  notas: string | null
  registradoPorId: number
  /** true = ya se lo llevó; false = queda «por recoger» hasta que confirme */
  entregado: boolean
}): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO prestamo
       (equipo_id, responsable_id, asignado_a_id, evento_id, estado_entrega, notas, registrado_por_id, recogido_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${datos.entregado ? 'NOW()' : 'NULL'})`,
    [
      datos.equipoId,
      datos.responsableId,
      datos.asignadoAId,
      datos.eventoId,
      datos.estadoEntrega,
      datos.notas,
      datos.registradoPorId,
    ],
  )
  return resultado.insertId
}

/** Cierra el préstamo: vuelve el equipo y se anota en qué estado lo recibieron. */
export async function cerrarPrestamo(
  id: number,
  datos: {
    estadoDevolucion: ConservacionEquipo
    notas: string | null
    devueltoPorId: number
  },
): Promise<void> {
  await ejecutar(
    `UPDATE prestamo
        SET devuelto_en = NOW(),
            estado_devolucion = ?,
            notas = COALESCE(?, notas),
            devuelto_por_id = ?
      WHERE id = ? AND devuelto_en IS NULL`,
    [datos.estadoDevolucion, datos.notas, datos.devueltoPorId, id],
  )
}

/** Quien lleva el equipo confirma que ya lo recogió. Devuelve las filas tocadas (0 = ya estaba confirmado o cerrado). */
export async function marcarRecogido(id: number): Promise<number> {
  const resultado = await ejecutar(
    `UPDATE prestamo SET recogido_en = NOW()
      WHERE id = ? AND recogido_en IS NULL AND devuelto_en IS NULL`,
    [id],
  )
  return resultado.affectedRows
}

/**
 * Quien lo trae avisa que ya lo devolvió y en qué estado. El préstamo NO se cierra:
 * lo cierra el ministerio al recibirlo (`cerrarPrestamo`).
 */
export async function marcarDevolucionAvisada(
  id: number,
  datos: { estado: ConservacionEquipo; notas: string | null },
): Promise<number> {
  const resultado = await ejecutar(
    `UPDATE prestamo
        SET devolucion_avisada_en = NOW(),
            estado_devolucion_avisado = ?,
            notas = COALESCE(?, notas)
      WHERE id = ? AND recogido_en IS NOT NULL AND devolucion_avisada_en IS NULL AND devuelto_en IS NULL`,
    [datos.estado, datos.notas, id],
  )
  return resultado.affectedRows
}

/** ¿Esta cuenta lleva (o tiene asignado) algún equipo sin cerrar? Para mostrar «Mi servicio». */
export async function tieneEquipoACargo(usuarioId: number): Promise<boolean> {
  const fila = await consultarUno<RowDataPacket>(
    `SELECT 1 AS si FROM prestamo
      WHERE devuelto_en IS NULL AND (responsable_id = ? OR asignado_a_id = ?) LIMIT 1`,
    [usuarioId, usuarioId],
  )
  return fila != null
}

/**
 * Borra un préstamo del historial (solo si sigue abierto: un préstamo cerrado
 * es el registro de que el equipo volvió y no se toca).
 */
export async function borrarPrestamoAbierto(id: number): Promise<number> {
  const resultado = await ejecutar(`DELETE FROM prestamo WHERE id = ? AND devuelto_en IS NULL`, [id])
  return resultado.affectedRows
}
