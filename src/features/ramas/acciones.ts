'use server'

import { revalidatePath } from 'next/cache'
import { esquemaRama, esquemaRamaEdicion, primerError } from '@/lib/validaciones'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import {
  actualizarRama,
  crearRama,
  desactivarRama,
  buscarRama,
} from '@/lib/db/ramas'
import type { EstadoFormulario } from '@/features/tipos'

/** Error de clave duplicada de MySQL, traducido a un mensaje amable. */
function errorDeMySQL(error: unknown): string | null {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === 'ER_DUP_ENTRY') return 'Ya existe un registro con ese nombre.'
  if (codigo === 'ER_NO_REFERENCED_ROW_2') return 'El líder indicado no existe.'
  return null
}

export async function guardarRama(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const permiso = await exigirPermisoAccion('crear', 'rama')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const datos = esquemaRama.safeParse({
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  try {
    await crearRama(datos.data)
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  revalidatePath('/panel/ramas')
  return { ok: true }
}

export async function editarRama(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const ramaId = Number(formData.get('id'))
  if (!Number.isInteger(ramaId) || ramaId <= 0) {
    return { ok: false, error: 'Rama no válida.' }
  }

  const permiso = await exigirPermisoAccion('editar', 'rama', { ramaId })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const datos = esquemaRamaEdicion.safeParse({
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    liderId: formData.get('liderId'),
    activa: formData.get('activa') === 'on' ? 'true' : '',
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  const existente = await buscarRama(ramaId, permiso.usuario)
  if (!existente) return { ok: false, error: 'La rama ya no existe.' }

  try {
    await actualizarRama(ramaId, {
      nombre: datos.data.nombre,
      descripcion: datos.data.descripcion,
      liderId: datos.data.liderId,
      activa: datos.data.activa,
    })
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  revalidatePath('/panel/ramas')
  revalidatePath(`/panel/ramas/${ramaId}`)
  return { ok: true }
}

export async function borrarRama(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const ramaId = Number(formData.get('id'))
  if (!Number.isInteger(ramaId) || ramaId <= 0) {
    return { ok: false, error: 'Rama no válida.' }
  }

  const permiso = await exigirPermisoAccion('eliminar', 'rama', { ramaId })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  await desactivarRama(ramaId)
  revalidatePath('/panel/ramas')
  return { ok: true }
}
