'use server'

import { revalidatePath } from 'next/cache'
import { getUsuarioActual } from '@/lib/auth/sesion'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import { puede } from '@/lib/auth/permisos'
import { dentroDelMinisterio } from '@/lib/db/alcance'
import {
  asignarTurnos,
  borrarLlegada,
  confirmarTurno,
  crearEvento,
  desactivarEvento,
  eventoDeRegistro,
  listarAsignables,
  quitarTurno,
  registrarLlegada,
  turnoDe,
  actualizarEvento,
} from '@/lib/db/eventos'
import {
  esquemaAsignacion,
  esquemaConfirmacion,
  esquemaEvento,
  esquemaEventoEdicion,
  esquemaLlegada,
  primerError,
} from '@/lib/validaciones'
import { instanteParaSQL } from '@/lib/servicio'
import type { EstadoFormulario } from '@/features/tipos'

/**
 * Server actions de los eventos de servicio.
 *
 * Dos familias de acciones:
 *  1. Organizar (crear/editar/asignar/checar por otro) → piden permiso con el
 *     ámbito del ministerio del evento.
 *  2. Lo propio de cada servidor (confirmar mi asistencia, marcar MI llegada)
 *     → no piden permiso: lo que autoriza es que el turno sea suyo. El id de la
 *     persona sale SIEMPRE de la sesión, nunca del formulario; el campo
 *     `usuarioId` solo puede pedir por OTRA persona, y eso sí pide permiso
 *     (`evento:checar` para la llegada, `evento:editar` para la confirmación).
 */

function refrescarEvento(eventoId?: number): void {
  revalidatePath('/panel/ministerio')
  revalidatePath('/panel/ministerio/eventos')
  revalidatePath('/panel/ministerio/mis-turnos')
  if (eventoId != null) revalidatePath(`/panel/ministerio/eventos/${eventoId}`)
}

/* ── Organizar el evento ─────────────────────────────────────── */

export async function guardarEvento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaEvento.safeParse({
    ministerioId: formData.get('ministerioId'),
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    fecha: formData.get('fecha'),
    hora: formData.get('hora'),
    latitud: formData.get('latitud'),
    longitud: formData.get('longitud'),
    direccion: formData.get('direccion'),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const permiso = await exigirPermisoAccion('crear', 'evento', {
    ministerioId: datos.data.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  await crearEvento({
    ministerioId: datos.data.ministerioId,
    nombre: datos.data.nombre,
    descripcion: datos.data.descripcion,
    fecha: datos.data.fecha,
    horaLlegada: datos.data.hora,
    latitud: datos.data.latitud,
    longitud: datos.data.longitud,
    direccion: datos.data.direccion,
    creadoPorId: permiso.usuario.id,
  })
  refrescarEvento()
  return { ok: true }
}

export async function editarEvento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const eventoId = Number(formData.get('id'))
  if (!Number.isInteger(eventoId) || eventoId <= 0) return { ok: false, error: 'Evento no válido.' }

  const datos = esquemaEventoEdicion.safeParse({
    id: eventoId,
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    fecha: formData.get('fecha'),
    hora: formData.get('hora'),
    latitud: formData.get('latitud'),
    longitud: formData.get('longitud'),
    direccion: formData.get('direccion'),
    activo: formData.get('activo') === 'on' ? 'on' : '',
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const evento = await eventoDeRegistro(eventoId)
  if (!evento) return { ok: false, error: 'El evento ya no existe.' }

  const permiso = await exigirPermisoAccion('editar', 'evento', {
    ministerioId: evento.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  await actualizarEvento(eventoId, {
    nombre: datos.data.nombre,
    descripcion: datos.data.descripcion,
    fecha: datos.data.fecha,
    horaLlegada: datos.data.hora,
    latitud: datos.data.latitud,
    longitud: datos.data.longitud,
    direccion: datos.data.direccion,
    activo: datos.data.activo,
  })
  refrescarEvento(eventoId)
  return { ok: true }
}

export async function borrarEvento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const eventoId = Number(formData.get('id'))
  if (!Number.isInteger(eventoId) || eventoId <= 0) return { ok: false, error: 'Evento no válido.' }

  const evento = await eventoDeRegistro(eventoId)
  if (!evento) return { ok: false, error: 'El evento ya no existe.' }

  const permiso = await exigirPermisoAccion('eliminar', 'evento', {
    ministerioId: evento.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  await desactivarEvento(eventoId)
  refrescarEvento(eventoId)
  return { ok: true }
}

/* ── Armar la lista de quién sirve ───────────────────────────── */

export async function asignarServidores(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const eventoId = Number(formData.get('eventoId'))
  if (!Number.isInteger(eventoId) || eventoId <= 0) return { ok: false, error: 'Evento no válido.' }

  const usuarios = formData
    .getAll('usuario')
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0)

  const datos = esquemaAsignacion.safeParse({ eventoId, usuarios })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const evento = await eventoDeRegistro(eventoId)
  if (!evento) return { ok: false, error: 'El evento ya no existe.' }

  const permiso = await exigirPermisoAccion('asignar', 'evento', {
    ministerioId: evento.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  // Solo se puede asignar a quien puede servir en ESTE ministerio: la lista de
  // candidatos se recalcula en el servidor (los ids llegan del cliente).
  const asignables = new Set((await listarAsignables(evento.ministerioId)).map((cuenta) => cuenta.id))
  const validos = datos.data.usuarios.filter((usuarioId) => asignables.has(usuarioId))
  if (validos.length !== datos.data.usuarios.length) {
    return { ok: false, error: 'Alguna de las cuentas elegidas no sirve en este ministerio.' }
  }
  if (validos.length === 0) {
    return { ok: false, error: 'Elige al menos una cuenta.' }
  }

  await asignarTurnos(eventoId, validos)
  refrescarEvento(eventoId)
  return { ok: true }
}

export async function quitarServidor(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const eventoId = Number(formData.get('eventoId'))
  const usuarioId = Number(formData.get('usuarioId'))
  if (!Number.isInteger(eventoId) || !Number.isInteger(usuarioId)) {
    return { ok: false, error: 'Turno no válido.' }
  }

  const evento = await eventoDeRegistro(eventoId)
  if (!evento) return { ok: false, error: 'El evento ya no existe.' }

  const permiso = await exigirPermisoAccion('asignar', 'evento', {
    ministerioId: evento.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const quitado = await quitarTurno(eventoId, usuarioId)
  if (!quitado) {
    return {
      ok: false,
      error: 'No se puede quitar a quien ya registró su llegada: quita primero la llegada.',
    }
  }
  refrescarEvento(eventoId)
  return { ok: true }
}

/* ── Lo propio de cada servidor ──────────────────────────────── */

/**
 * Quién es el objetivo real de la acción y si puede hacerla.
 * Devuelve el id de la persona a la que se le toca el turno, o el error.
 */
async function resolverObjetivo(
  eventoId: number,
  usuarioIdPedido: number | null,
  accionDelegada: 'checar' | 'editar',
): Promise<{ usuarioObjetivoId: number; actorId: number; ministerioId: number } | { error: string }> {
  const actor = await getUsuarioActual()
  if (!actor) return { error: 'Tu sesión ha caducado. Vuelve a entrar.' }

  const evento = await eventoDeRegistro(eventoId)
  if (!evento) return { error: 'El evento ya no existe.' }

  const objetivoId = usuarioIdPedido ?? actor.id
  if (objetivoId !== actor.id) {
    if (!puede(actor, accionDelegada, 'evento', { ministerioId: evento.ministerioId })) {
      return {
        error:
          accionDelegada === 'checar'
            ? 'Solo el encargado del ministerio puede marcar la llegada de otra persona.'
            : 'Solo el encargado del ministerio puede confirmar por otra persona.',
      }
    }
    return { usuarioObjetivoId: objetivoId, actorId: actor.id, ministerioId: evento.ministerioId }
  }

  // Su propio turno: tiene que estar asignado y ser de un ministerio que le toca.
  if (!dentroDelMinisterio(actor, evento.ministerioId)) {
    return { error: 'Ese evento es de otro ministerio.' }
  }
  const turno = await turnoDe(eventoId, actor.id)
  if (!turno) return { error: 'No estás asignado a este evento.' }
  return { usuarioObjetivoId: actor.id, actorId: actor.id, ministerioId: evento.ministerioId }
}

/** «Sí voy» (o quitar la confirmación) de un turno. */
export async function confirmarAsistencia(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaConfirmacion.safeParse({
    eventoId: formData.get('eventoId'),
    usuarioId: formData.get('usuarioId'),
    confirmado: formData.get('confirmado') === 'on' ? 'on' : '',
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const objetivo = await resolverObjetivo(datos.data.eventoId, datos.data.usuarioId, 'editar')
  if ('error' in objetivo) return { ok: false, error: objetivo.error }

  const filas = await confirmarTurno(
    datos.data.eventoId,
    objetivo.usuarioObjetivoId,
    datos.data.confirmado,
  )
  if (filas === 0) return { ok: false, error: 'No se encontró ese turno.' }

  refrescarEvento(datos.data.eventoId)
  return { ok: true }
}

/**
 * Marca la llegada con la ubicación de quien checa. La hora y el punto se
 * guardan tal cual: así se puede ver si llegó a tiempo y dónde estaba.
 */
export async function marcarLlegada(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaLlegada.safeParse({
    eventoId: formData.get('eventoId'),
    usuarioId: formData.get('usuarioId'),
    llegoEn: formData.get('llegoEn'),
    latitud: formData.get('latitud'),
    longitud: formData.get('longitud'),
    direccion: formData.get('direccion'),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const objetivo = await resolverObjetivo(datos.data.eventoId, datos.data.usuarioId, 'checar')
  if ('error' in objetivo) return { ok: false, error: objetivo.error }

  const filas = await registrarLlegada(datos.data.eventoId, objetivo.usuarioObjetivoId, {
    // Vacío = ahora, según el reloj del servidor (la base lo pone).
    llegoEn: datos.data.llegoEn ? instanteParaSQL(datos.data.llegoEn) : null,
    latitud: datos.data.latitud,
    longitud: datos.data.longitud,
    direccion: datos.data.direccion,
    registradoPorId: objetivo.actorId,
  })
  if (filas === 0) return { ok: false, error: 'No se encontró ese turno.' }

  refrescarEvento(datos.data.eventoId)
  return { ok: true }
}

/** Deja el turno sin llegada (para corregir una checada equivocada). */
export async function quitarLlegada(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const eventoId = Number(formData.get('eventoId'))
  const usuarioId = Number(formData.get('usuarioId'))
  if (!Number.isInteger(eventoId) || !Number.isInteger(usuarioId)) {
    return { ok: false, error: 'Turno no válido.' }
  }

  const evento = await eventoDeRegistro(eventoId)
  if (!evento) return { ok: false, error: 'El evento ya no existe.' }

  const permiso = await exigirPermisoAccion('checar', 'evento', {
    ministerioId: evento.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  await borrarLlegada(eventoId, usuarioId)
  refrescarEvento(eventoId)
  return { ok: true }
}
