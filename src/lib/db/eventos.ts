import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import { filtroMinisterio, type IdentidadMinisterio } from '@/lib/db/alcance'
import type { Alcance, Evento, TurnoEvento } from '@/types/domain'
import { aInstante, fechaDeInstante } from '@/lib/servicio'

/**
 * Acceso a datos de `evento` (el día en que sirve el ministerio) y de
 * `servidor_evento` (un turno: quién sirve, quién confirmó y a qué hora llegó).
 *
 * Las fechas viajan como ISO corto (AAAA-MM-DD) y las horas como HH:MM; las
 * marcas de llegada, como ISO de reloj de pared (ver lib/servicio.ts).
 */

interface FilaEvento extends RowDataPacket {
  id: number
  ministerio_id: number
  nombre: string
  descripcion: string | null
  fecha: Date | string
  hora_llegada: string | null
  latitud: string | number | null
  longitud: string | number | null
  direccion: string | null
  activo: number | boolean
  creado_en: Date | string
  ministerio_nombre?: string | null
  total_turnos?: number | string
  confirmados?: number | string
  llegaron?: number | string
}

/** Columnas de un turno ya con su nombre final (sin ser fila de MySQL: también se arma a mano). */
interface DatosTurno {
  id: number
  evento_id: number
  usuario_id: number
  funcion: string | null
  confirmado: number | boolean
  confirmado_en: Date | string | null
  llego_en: Date | string | null
  latitud: string | number | null
  longitud: string | number | null
  direccion: string | null
  registrado_por_id: number | null
  usuario_nombre?: string | null
}

interface FilaTurno extends RowDataPacket, DatosTurno {}

/**
 * Fila de «Mis turnos»: evento y turno en la MISMA fila. Las columnas que se llaman igual en
 * `evento` y en `servidor_evento` (id, latitud, longitud, direccion) llevan alias en el turno;
 * sin ellos el turno pisaba al evento y el enlace llevaba a otro evento (o a ninguno).
 */
interface FilaMiTurno extends FilaEvento {
  turno_id: number
  turno_usuario_id: number
  funcion: string | null
  confirmado: number | boolean
  confirmado_en: Date | string | null
  llego_en: Date | string | null
  turno_latitud: string | number | null
  turno_longitud: string | number | null
  turno_direccion: string | null
  registrado_por_id: number | null
}

const COLUMNAS_EVENTO = `e.id, e.ministerio_id, e.nombre, e.descripcion, e.fecha, e.hora_llegada,
  e.latitud, e.longitud, e.direccion, e.activo, e.creado_en,
  (SELECT COUNT(*) FROM servidor_evento s WHERE s.evento_id = e.id) AS total_turnos,
  (SELECT COUNT(*) FROM servidor_evento s WHERE s.evento_id = e.id AND s.confirmado = 1) AS confirmados,
  (SELECT COUNT(*) FROM servidor_evento s WHERE s.evento_id = e.id AND s.llego_en IS NOT NULL) AS llegaron`

const COLUMNAS_TURNO = `s.id, s.evento_id, s.usuario_id, s.funcion, s.confirmado, s.confirmado_en, s.llego_en,
  s.latitud, s.longitud, s.direccion, s.registrado_por_id`

/** MySQL entrega los DECIMAL como texto: se convierten al leer. */
function aNumero(valor: string | number | null): number | null {
  if (valor == null) return null
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function aFecha(valor: Date | string): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return String(valor).slice(0, 10)
}

function aHora(valor: string | null): string | null {
  return valor == null ? null : String(valor).slice(0, 5)
}

function aEvento(fila: FilaEvento): Evento {
  return {
    id: fila.id,
    ministerioId: fila.ministerio_id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    fecha: aFecha(fila.fecha),
    horaLlegada: aHora(fila.hora_llegada),
    ubicacion: {
      latitud: aNumero(fila.latitud),
      longitud: aNumero(fila.longitud),
      direccion: fila.direccion,
    },
    activo: Boolean(fila.activo),
    creadoEn: aInstante(fila.creado_en) ?? '',
    nombreMinisterio: fila.ministerio_nombre ?? null,
  }
}

function aTurno(fila: DatosTurno): TurnoEvento {
  return {
    id: fila.id,
    eventoId: fila.evento_id,
    usuarioId: fila.usuario_id,
    funcion: fila.funcion,
    confirmado: Boolean(fila.confirmado),
    confirmadoEn: aInstante(fila.confirmado_en),
    llegoEn: aInstante(fila.llego_en),
    ubicacion: {
      latitud: aNumero(fila.latitud),
      longitud: aNumero(fila.longitud),
      direccion: fila.direccion,
    },
    registradoPorId: fila.registrado_por_id,
    nombreUsuario: fila.usuario_nombre ?? null,
  }
}

/** Evento con el resumen de sus turnos, para los listados. */
export interface EventoConResumen extends Evento {
  totalServidores: number
  confirmados: number
  llegaron: number
}

function aEventoConResumen(fila: FilaEvento): EventoConResumen {
  return {
    ...aEvento(fila),
    totalServidores: Number(fila.total_turnos ?? 0),
    confirmados: Number(fila.confirmados ?? 0),
    llegaron: Number(fila.llegaron ?? 0),
  }
}

/** Eventos visibles, opcionalmente desde una fecha (por defecto, todos). */
export async function listarEventos(
  identidad: IdentidadMinisterio,
  opciones: { ministerioId?: number; desde?: string; hasta?: string; soloActivos?: boolean } = {},
): Promise<EventoConResumen[]> {
  const filtro = filtroMinisterio(identidad, 'e.ministerio_id')
  const condiciones = [filtro.sql]
  const parametros: unknown[] = [...filtro.parametros]

  if (opciones.ministerioId != null) {
    condiciones.push('e.ministerio_id = ?')
    parametros.push(opciones.ministerioId)
  }
  if (opciones.desde) {
    condiciones.push('e.fecha >= ?')
    parametros.push(opciones.desde)
  }
  if (opciones.hasta) {
    condiciones.push('e.fecha <= ?')
    parametros.push(opciones.hasta)
  }
  if (opciones.soloActivos !== false) condiciones.push('e.activo = 1')

  const filas = await consultar<FilaEvento>(
    `SELECT ${COLUMNAS_EVENTO}, m.nombre AS ministerio_nombre
       FROM evento e
       JOIN ministerio m ON m.id = e.ministerio_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY e.fecha DESC, e.hora_llegada`,
    parametros,
  )
  return filas.map(aEventoConResumen)
}

/** Evento por id respetando el alcance. */
export async function buscarEvento(id: number, identidad: IdentidadMinisterio): Promise<Evento | null> {
  const filtro = filtroMinisterio(identidad, 'e.ministerio_id')
  const fila = await consultarUno<FilaEvento>(
    `SELECT ${COLUMNAS_EVENTO} FROM evento e WHERE e.id = ? AND ${filtro.sql}`,
    [id, ...filtro.parametros],
  )
  return fila ? aEvento(fila) : null
}

/** Datos del evento SIN filtrar alcance: para saber a qué ministerio pertenece. */
export async function eventoDeRegistro(id: number): Promise<{
  id: number
  ministerioId: number
  nombre: string
  fecha: string
  horaLlegada: string | null
} | null> {
  const fila = await consultarUno<FilaEvento>(
    `SELECT id, ministerio_id, nombre, fecha, hora_llegada FROM evento WHERE id = ?`,
    [id],
  )
  return fila
    ? {
        id: fila.id,
        ministerioId: fila.ministerio_id,
        nombre: fila.nombre,
        fecha: aFecha(fila.fecha),
        horaLlegada: aHora(fila.hora_llegada),
      }
    : null
}

export async function crearEvento(datos: {
  ministerioId: number
  nombre: string
  descripcion: string | null
  fecha: string
  horaLlegada: string | null
  latitud: number | null
  longitud: number | null
  direccion: string | null
  creadoPorId: number
}): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO evento
       (ministerio_id, nombre, descripcion, fecha, hora_llegada, latitud, longitud, direccion, creado_por_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.ministerioId,
      datos.nombre,
      datos.descripcion,
      datos.fecha,
      datos.horaLlegada,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.creadoPorId,
    ],
  )
  return resultado.insertId
}

export async function actualizarEvento(
  id: number,
  datos: {
    nombre: string
    descripcion: string | null
    fecha: string
    horaLlegada: string | null
    latitud: number | null
    longitud: number | null
    direccion: string | null
    activo: boolean
  },
): Promise<void> {
  await ejecutar(
    `UPDATE evento
        SET nombre = ?, descripcion = ?, fecha = ?, hora_llegada = ?,
            latitud = ?, longitud = ?, direccion = ?, activo = ?
      WHERE id = ?`,
    [
      datos.nombre,
      datos.descripcion,
      datos.fecha,
      datos.horaLlegada,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.activo ? 1 : 0,
      id,
    ],
  )
}

export async function desactivarEvento(id: number): Promise<void> {
  await ejecutar(`UPDATE evento SET activo = 0 WHERE id = ?`, [id])
}

/* ── Turnos: quién sirve, quién confirmó y quién llegó ───────── */

/** Turnos de un evento, con el nombre de cada servidor. */
export async function listarTurnos(eventoId: number): Promise<TurnoEvento[]> {
  const filas = await consultar<FilaTurno>(
    `SELECT ${COLUMNAS_TURNO}, u.nombre AS usuario_nombre
       FROM servidor_evento s
       JOIN usuario u ON u.id = s.usuario_id
      WHERE s.evento_id = ?
      ORDER BY u.nombre`,
    [eventoId],
  )
  return filas.map(aTurno)
}

/** Turno de una cuenta en un evento (null si no está asignada). */
export async function turnoDe(eventoId: number, usuarioId: number): Promise<TurnoEvento | null> {
  const fila = await consultarUno<FilaTurno>(
    `SELECT ${COLUMNAS_TURNO} FROM servidor_evento s WHERE s.evento_id = ? AND s.usuario_id = ?`,
    [eventoId, usuarioId],
  )
  return fila ? aTurno(fila) : null
}

/**
 * Suma servidores al evento con el rol que tendrán. Los que ya estaban no se
 * duplican ni se tocan (su rol se cambia con `cambiarFuncion`).
 */
export async function asignarTurnos(
  eventoId: number,
  usuarioIds: number[],
  funcion: string | null = null,
): Promise<number> {
  if (usuarioIds.length === 0) return 0
  const valores = usuarioIds.map(() => '(?, ?, ?)').join(', ')
  const parametros = usuarioIds.flatMap((usuarioId) => [eventoId, usuarioId, funcion])
  const resultado = await ejecutar(
    `INSERT IGNORE INTO servidor_evento (evento_id, usuario_id, funcion) VALUES ${valores}`,
    parametros,
  )
  return resultado.affectedRows
}

/** Cambia el rol de un servidor en el evento (null lo deja sin definir). */
export async function cambiarFuncion(
  eventoId: number,
  usuarioId: number,
  funcion: string | null,
): Promise<number> {
  const resultado = await ejecutar(
    `UPDATE servidor_evento SET funcion = ? WHERE evento_id = ? AND usuario_id = ?`,
    [funcion, eventoId, usuarioId],
  )
  return resultado.affectedRows
}

/**
 * Quita a alguien del evento. Un turno con llegada registrada NO se borra
 * (sería borrar la evidencia de que sirvió): primero se limpia la llegada si
 * de verdad hay que quitarlo.
 * Devuelve true si quedó fuera.
 */
export async function quitarTurno(eventoId: number, usuarioId: number): Promise<boolean> {
  const resultado = await ejecutar(
    `DELETE FROM servidor_evento WHERE evento_id = ? AND usuario_id = ? AND llego_en IS NULL`,
    [eventoId, usuarioId],
  )
  return resultado.affectedRows > 0
}

/** Marca «sí voy» (o retira la confirmación). */
export async function confirmarTurno(
  eventoId: number,
  usuarioId: number,
  confirmado: boolean,
): Promise<number> {
  const resultado = await ejecutar(
    `UPDATE servidor_evento
        SET confirmado = ?, confirmado_en = CASE WHEN ? THEN NOW() ELSE NULL END
      WHERE evento_id = ? AND usuario_id = ?`,
    [confirmado ? 1 : 0, confirmado ? 1 : 0, eventoId, usuarioId],
  )
  return resultado.affectedRows
}

/**
 * Registra la llegada con la ubicación donde se marcó.
 * `llegoEn` vacío = ahora (lo pone la base). Quien marca por otro queda
 * anotado en `registrado_por_id`.
 */
export async function registrarLlegada(
  eventoId: number,
  usuarioId: number,
  datos: {
    /** `AAAA-MM-DD HH:MM:SS`, o null para usar la hora del servidor */
    llegoEn: string | null
    latitud: number | null
    longitud: number | null
    direccion: string | null
    registradoPorId: number
  },
): Promise<number> {
  const resultado = await ejecutar(
    `UPDATE servidor_evento
        SET llego_en = COALESCE(?, NOW()),
            latitud = ?,
            longitud = ?,
            direccion = ?,
            registrado_por_id = ?
      WHERE evento_id = ? AND usuario_id = ?`,
    [
      datos.llegoEn,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.registradoPorId,
      eventoId,
      usuarioId,
    ],
  )
  return resultado.affectedRows
}

/** Borra una llegada mal marcada (para volver a checar). */
export async function borrarLlegada(eventoId: number, usuarioId: number): Promise<void> {
  await ejecutar(
    `UPDATE servidor_evento
        SET llego_en = NULL, latitud = NULL, longitud = NULL, direccion = NULL, registrado_por_id = NULL
      WHERE evento_id = ? AND usuario_id = ?`,
    [eventoId, usuarioId],
  )
}

/* ── Consultas de apoyo para las pantallas ───────────────────── */

/** Cuenta reducida, para armar la lista de quién sirve. */
export interface CuentaAsignable {
  id: number
  nombre: string
  email: string
  rolNombre: string
  alcance: Alcance
  ministerioId: number | null
}

/**
 * Cuentas que se pueden asignar a un evento: las del ministerio y las de
 * organización (un administrador también puede servir). Nunca las de otro
 * ministerio, y nunca una cuenta desactivada.
 */
export async function listarAsignables(ministerioId: number): Promise<CuentaAsignable[]> {
  const filas = await consultar<{
    id: number
    nombre: string
    email: string
    rol_nombre: string
    alcance: Alcance
    ministerio_id: number | null
  }>(
    `SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, r.alcance, u.ministerio_id
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.activo = 1
        AND (u.ministerio_id = ? OR r.alcance = 'ORGANIZACION')
      ORDER BY u.nombre`,
    [ministerioId],
  )
  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    rolNombre: fila.rol_nombre,
    alcance: fila.alcance,
    ministerioId: fila.ministerio_id,
  }))
}

/** Un turno con su evento: es lo que ve alguien en «Mis turnos». */
export interface TurnoConEvento {
  evento: Evento
  turno: TurnoEvento
}

/**
 * Los eventos en los que está asignada una cuenta, a partir de una fecha.
 * Es la única consulta del módulo que NO filtra por alcance: quien pregunta es
 * la propia persona por SUS turnos (el id sale de la sesión, nunca del cliente).
 */
export async function listarMisTurnos(
  usuarioId: number,
  opciones: { desde?: string } = {},
): Promise<TurnoConEvento[]> {
  const filas = await consultar<FilaMiTurno>(
    `SELECT ${COLUMNAS_EVENTO}, m.nombre AS ministerio_nombre,
            s.id AS turno_id, s.usuario_id AS turno_usuario_id, s.funcion, s.confirmado,
            s.confirmado_en, s.llego_en, s.latitud AS turno_latitud, s.longitud AS turno_longitud,
            s.direccion AS turno_direccion, s.registrado_por_id
       FROM servidor_evento s
       JOIN evento e ON e.id = s.evento_id
       JOIN ministerio m ON m.id = e.ministerio_id
      WHERE s.usuario_id = ?
        AND e.activo = 1
        ${opciones.desde ? 'AND e.fecha >= ?' : ''}
      ORDER BY e.fecha, e.hora_llegada`,
    opciones.desde ? [usuarioId, opciones.desde] : [usuarioId],
  )

  return filas.map((fila) => ({
    evento: aEvento(fila),
    turno: aTurno({
      id: fila.turno_id,
      evento_id: fila.id,
      usuario_id: fila.turno_usuario_id,
      funcion: fila.funcion,
      confirmado: fila.confirmado,
      confirmado_en: fila.confirmado_en,
      llego_en: fila.llego_en,
      latitud: fila.turno_latitud,
      longitud: fila.turno_longitud,
      direccion: fila.turno_direccion,
      registrado_por_id: fila.registrado_por_id,
    }),
  }))
}

/** Fecha de hoy en el reloj de la base (para comparar con `evento.fecha`). */
export async function hoyDeLaBase(): Promise<string> {
  const fila = await consultarUno<{ hoy: string }>(`SELECT CURDATE() AS hoy`)
  return fechaDeInstante(fila?.hoy ?? null) ?? new Date().toISOString().slice(0, 10)
}
