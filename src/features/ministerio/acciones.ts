'use server'

import { revalidatePath } from 'next/cache'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import {
  esquemaDevolucion,
  esquemaEquipo,
  esquemaEquipoEdicion,
  esquemaMinisterio,
  esquemaMinisterioEdicion,
  esquemaPrestamo,
  primerError,
} from '@/lib/validaciones'
import {
  actualizarMinisterio,
  crearMinisterio,
  desactivarMinisterio,
} from '@/lib/db/ministerios'
import {
  actualizarEquipo,
  crearEquipo,
  equipoConMinisterio,
  sincronizarEstatusEquipo,
} from '@/lib/db/equipos'
import {
  abrirPrestamo,
  borrarPrestamoAbierto,
  cerrarPrestamo,
  prestamoAbiertoDe,
  prestamoDeRegistro,
} from '@/lib/db/prestamos'
import type { EstadoFormulario } from '@/features/tipos'

/**
 * Server actions del módulo de ministerio: ministerios, equipos y préstamos.
 *
 * Cada acción comprueba el permiso con el ámbito REAL del objeto (a qué
 * ministerio pertenece lo que se toca, buscado en la base y nunca tomado del
 * cliente) y al final avisa a las pantallas que cambian. El alcance tampoco se
 * confía a la interfaz: las consultas ya vienen acotadas (lib/db/alcance.ts).
 */

/** Rutas que muestran datos del ministerio y hay que refrescar tras guardar. */
function refrescarMinisterio(): void {
  revalidatePath('/panel/ministerio')
  revalidatePath('/panel/ministerio/equipos')
  revalidatePath('/panel/ministerio/prestamos')
}

function errorDeMySQL(error: unknown): string | null {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === 'ER_DUP_ENTRY') return 'Ya existe un registro con ese nombre.'
  if (codigo === 'ER_NO_REFERENCED_ROW_2') return 'Ese ministerio o esa cuenta ya no existe.'
  return null
}

/* ── Ministerios ─────────────────────────────────────────────── */

export async function guardarMinisterio(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaMinisterio.safeParse({
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const permiso = await exigirPermisoAccion('crear', 'ministerio')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  try {
    await crearMinisterio(datos.data)
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }
  refrescarMinisterio()
  return { ok: true }
}

export async function editarMinisterio(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const ministerioId = Number(formData.get('id'))
  if (!Number.isInteger(ministerioId) || ministerioId <= 0) {
    return { ok: false, error: 'Ministerio no válido.' }
  }

  const datos = esquemaMinisterioEdicion.safeParse({
    id: ministerioId,
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    encargadoId: formData.get('encargadoId'),
    activo: formData.get('activo') === 'on' ? 'on' : '',
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const permiso = await exigirPermisoAccion('editar', 'ministerio', { ministerioId })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  try {
    await actualizarMinisterio(ministerioId, {
      nombre: datos.data.nombre,
      descripcion: datos.data.descripcion,
      encargadoId: datos.data.encargadoId,
      activo: datos.data.activo,
    })
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }
  refrescarMinisterio()
  return { ok: true }
}

export async function borrarMinisterio(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const ministerioId = Number(formData.get('id'))
  if (!Number.isInteger(ministerioId) || ministerioId <= 0) {
    return { ok: false, error: 'Ministerio no válido.' }
  }

  const permiso = await exigirPermisoAccion('eliminar', 'ministerio', { ministerioId })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  await desactivarMinisterio(ministerioId)
  refrescarMinisterio()
  return { ok: true }
}

/* ── Equipos ─────────────────────────────────────────────────── */

export async function guardarEquipo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaEquipo.safeParse({
    ministerioId: formData.get('ministerioId'),
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const permiso = await exigirPermisoAccion('crear', 'equipo', {
    ministerioId: datos.data.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  try {
    await crearEquipo(datos.data)
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }
  refrescarMinisterio()
  return { ok: true }
}

export async function editarEquipo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const equipoId = Number(formData.get('id'))
  if (!Number.isInteger(equipoId) || equipoId <= 0) return { ok: false, error: 'Equipo no válido.' }

  // El ministerio del equipo decide el ámbito: el id del cliente no basta.
  const equipo = await equipoConMinisterio(equipoId)
  if (!equipo) return { ok: false, error: 'El equipo ya no existe.' }

  const datos = esquemaEquipoEdicion.safeParse({
    id: equipoId,
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    estatus: formData.get('estatus'),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const permiso = await exigirPermisoAccion('editar', 'equipo', {
    ministerioId: equipo.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  // Un equipo prestado no puede declararse «disponible» a mano: primero vuelve.
  if (datos.data.estatus === 'DISPONIBLE' && (await prestamoAbiertoDe(equipoId))) {
    return {
      ok: false,
      error: 'Ese equipo está prestado. Registra la devolución antes de marcarlo disponible.',
    }
  }

  await actualizarEquipo(equipoId, datos.data)
  refrescarMinisterio()
  return { ok: true }
}

export async function borrarEquipo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const equipoId = Number(formData.get('id'))
  if (!Number.isInteger(equipoId) || equipoId <= 0) return { ok: false, error: 'Equipo no válido.' }

  const equipo = await equipoConMinisterio(equipoId)
  if (!equipo) return { ok: false, error: 'El equipo ya no existe.' }

  const permiso = await exigirPermisoAccion('eliminar', 'equipo', {
    ministerioId: equipo.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  // «Dar de baja» no borra: el equipo queda fuera de servicio y se conserva el
  // historial de préstamos (regla de la casa: desactivar, no borrar).
  if (await prestamoAbiertoDe(equipoId)) {
    return { ok: false, error: 'Ese equipo está prestado: primero registra la devolución.' }
  }
  await actualizarEquipo(equipoId, { nombre: equipo.nombre, descripcion: null, estatus: 'BAJA' })
  refrescarMinisterio()
  return { ok: true }
}

/* ── Préstamos ───────────────────────────────────────────────── */

export async function guardarPrestamo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaPrestamo.safeParse({
    equipoId: formData.get('equipoId'),
    responsableId: formData.get('responsableId'),
    asignadoAId: formData.get('asignadoAId'),
    estadoEntrega: formData.get('estadoEntrega'),
    notas: formData.get('notas'),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const equipo = await equipoConMinisterio(datos.data.equipoId)
  if (!equipo) return { ok: false, error: 'El equipo ya no existe.' }

  const permiso = await exigirPermisoAccion('crear', 'prestamo', {
    ministerioId: equipo.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  // Un equipo solo puede estar en manos de una persona a la vez.
  if (await prestamoAbiertoDe(datos.data.equipoId)) {
    return {
      ok: false,
      error: `«${equipo.nombre}» ya está prestado y no ha vuelto. Registra primero su devolución.`,
    }
  }
  if (equipo.estatus === 'BAJA') {
    return { ok: false, error: 'Ese equipo está fuera de servicio: no se puede prestar.' }
  }

  try {
    await abrirPrestamo({ ...datos.data, registradoPorId: permiso.usuario.id })
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }
  // El estatus sigue al historial: el equipo queda «prestado».
  await sincronizarEstatusEquipo(datos.data.equipoId)

  refrescarMinisterio()
  return { ok: true }
}

export async function registrarDevolucion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const prestamoId = Number(formData.get('id'))
  if (!Number.isInteger(prestamoId) || prestamoId <= 0) {
    return { ok: false, error: 'Préstamo no válido.' }
  }

  const datos = esquemaDevolucion.safeParse({
    id: prestamoId,
    estadoDevolucion: formData.get('estadoDevolucion'),
    notas: formData.get('notas'),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const registro = await prestamoDeRegistro(prestamoId)
  if (!registro) return { ok: false, error: 'Ese préstamo ya no existe.' }

  // El ámbito sale de los datos (a qué ministerio pertenece el equipo), no del
  // id que llegó en el formulario.
  const permiso = await exigirPermisoAccion('editar', 'prestamo', {
    ministerioId: registro.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }
  if (registro.devueltoEn) return { ok: false, error: 'Ese préstamo ya se había cerrado.' }

  await cerrarPrestamo(prestamoId, {
    estadoDevolucion: datos.data.estadoDevolucion,
    notas: datos.data.notas,
    devueltoPorId: permiso.usuario.id,
  })
  await sincronizarEstatusEquipo(registro.equipoId)

  refrescarMinisterio()
  return { ok: true }
}

export async function borrarPrestamo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const prestamoId = Number(formData.get('id'))
  if (!Number.isInteger(prestamoId) || prestamoId <= 0) {
    return { ok: false, error: 'Préstamo no válido.' }
  }

  const registro = await prestamoDeRegistro(prestamoId)
  if (!registro) return { ok: false, error: 'Ese préstamo ya no existe.' }

  const permiso = await exigirPermisoAccion('eliminar', 'prestamo', {
    ministerioId: registro.ministerioId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const borrados = await borrarPrestamoAbierto(prestamoId)
  if (borrados === 0) {
    return {
      ok: false,
      error: 'Solo se puede cancelar un préstamo que sigue abierto; uno cerrado es historial.',
    }
  }
  await sincronizarEstatusEquipo(registro.equipoId)
  refrescarMinisterio()
  return { ok: true }
}
