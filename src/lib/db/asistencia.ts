import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, transaccion } from '@/lib/db/conexion'
import type { Asistencia, EstadoAsistencia } from '@/types/domain'

/**
 * Acceso a datos del pase de lista: `reunion` (un encuentro de una célula en
 * una fecha) y `asistencia` (cómo le fue a cada integrante esa vez).
 *
 * El alcance no se filtra aquí dentro porque estas consultas siempre se piden
 * con una célula ya comprobada (`buscarCelula` con el alcance del rol) y se
 * pasan por la guarda correspondiente antes de escribir.
 */

interface FilaReunion extends RowDataPacket {
  id: number
  celula_id: number
  fecha: Date | string
  creado_en: Date | string
}

interface FilaAsistencia extends RowDataPacket {
  integrante_id: number
  estado: EstadoAsistencia
}

/** Las fechas de MySQL llegan como Date (o texto): a ISO corto. */
function aFecha(valor: Date | string): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return String(valor).slice(0, 10)
}

/** La reunión de esa fecha, o null si todavía no se ha abierto el pase. */
export async function buscarReunion(celulaId: number, fecha: string) {
  const fila = await consultarUno<FilaReunion>(
    `SELECT id, celula_id, fecha, creado_en FROM reunion WHERE celula_id = ? AND fecha = ?`,
    [celulaId, fecha],
  )
  if (!fila) return null
  return { id: fila.id, celulaId: fila.celula_id, fecha: aFecha(fila.fecha) }
}

/**
 * Lo que hay registrado para una célula en una fecha: la reunión (si existe) y
 * la asistencia ya marcada. Devuelve un array (no un Map) porque estos datos
 * cruzan al cliente al renderizar la ficha.
 */
export async function obtenerPaseDeLista(
  celulaId: number,
  fecha: string,
): Promise<{ reunionId: number | null; asistencias: Asistencia[] }> {
  const reunion = await buscarReunion(celulaId, fecha)
  if (!reunion) return { reunionId: null, asistencias: [] }

  const filas = await consultar<FilaAsistencia>(
    `SELECT integrante_id, estado FROM asistencia WHERE reunion_id = ?`,
    [reunion.id],
  )
  return {
    reunionId: reunion.id,
    asistencias: filas.map((fila) => ({ integranteId: fila.integrante_id, estado: fila.estado })),
  }
}

/**
 * Guarda el pase de lista de un día: crea la reunión si hace falta y deja el
 * estado de cada integrante. Todo en una transacción: o queda el pase completo
 * o no queda nada.
 */
export async function guardarPaseDeLista(datos: {
  celulaId: number
  fecha: string
  asistencias: Asistencia[]
}): Promise<void> {
  await transaccion(async (tx) => {
    // `LAST_INSERT_ID(id)` hace que MySQL devuelva el id de la reunión tanto si
    // acaba de crearla como si ya existía (hay una sola por célula y fecha).
    const reunion = await tx.ejecutar(
      `INSERT INTO reunion (celula_id, fecha) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [datos.celulaId, datos.fecha],
    )

    for (const asistencia of datos.asistencias) {
      await tx.ejecutar(
        `INSERT INTO asistencia (reunion_id, integrante_id, estado) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
        [reunion.insertId, asistencia.integranteId, asistencia.estado],
      )
    }
  })
}
