'use server'

import { revalidatePath } from 'next/cache'
import { esquemaRol, primerError } from '@/lib/validaciones'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import { puedeOtorgar } from '@/lib/auth/permisos'
import { ETIQUETAS_ALCANCE, permisoCompatibleConAlcance } from '@/lib/auth/catalogo'
import {
  actualizarRol,
  buscarRol,
  contarUsuariosDeRol,
  crearRol,
  eliminarRol,
} from '@/lib/db/roles'
import type { EstadoFormulario } from '@/features/tipos'

function errorDeMySQL(error: unknown): string | null {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === 'ER_DUP_ENTRY') return 'Ya existe un rol con ese nombre.'
  if (codigo === 'ER_ROW_IS_REFERENCED_2') return 'Hay cuentas que todavía usan este rol.'
  return null
}

/** Lee del formulario los campos de un rol (los permisos llegan como varios `permiso`). */
function leerRol(formData: FormData) {
  return esquemaRol.safeParse({
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    alcance: formData.get('alcance'),
    permisos: formData.getAll('permiso').map(String),
  })
}

export async function guardarRol(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const permiso = await exigirPermisoAccion('crear', 'rol')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const datos = leerRol(formData)
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const incompatible = datos.data.permisos.find(
    (texto) => !permisoCompatibleConAlcance(texto, datos.data.alcance),
  )
  if (incompatible) {
    return {
      ok: false,
      error: `El permiso «${incompatible}» solo lo puede tener un rol de alcance «${ETIQUETAS_ALCANCE.ORGANIZACION}».`,
    }
  }
  // Anti-escalada: no se pueden dar permisos que uno mismo no tiene.
  if (!puedeOtorgar(permiso.usuario, datos.data)) {
    return { ok: false, error: 'No puedes crear un rol con más permisos o más alcance que el tuyo.' }
  }

  try {
    await crearRol(datos.data)
  } catch (e) {
    const mensaje = errorDeMySQL(e)
    if (mensaje) return { ok: false, error: mensaje }
    throw e
  }

  revalidatePath('/panel/roles')
  return { ok: true }
}

export async function editarRol(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const rolId = Number(formData.get('id'))
  if (!Number.isInteger(rolId) || rolId <= 0) return { ok: false, error: 'Rol no válido.' }

  const permiso = await exigirPermisoAccion('editar', 'rol')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const actual = await buscarRol(rolId)
  if (!actual) return { ok: false, error: 'El rol ya no existe.' }
  if (actual.esSistema) {
    return {
      ok: false,
      error: 'El rol Administrador está protegido: siempre tiene todos los permisos.',
    }
  }
  // Para tocar un rol hay que tener, como mínimo, lo que ese rol ya concede.
  if (!puedeOtorgar(permiso.usuario, actual)) {
    return { ok: false, error: 'No puedes modificar un rol con más permisos o más alcance que el tuyo.' }
  }

  const datos = leerRol(formData)
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  const incompatible = datos.data.permisos.find(
    (texto) => !permisoCompatibleConAlcance(texto, datos.data.alcance),
  )
  if (incompatible) {
    return {
      ok: false,
      error: `El permiso «${incompatible}» solo lo puede tener un rol de alcance «${ETIQUETAS_ALCANCE.ORGANIZACION}».`,
    }
  }
  if (!puedeOtorgar(permiso.usuario, datos.data)) {
    return { ok: false, error: 'No puedes dar permisos o alcance que tú no tienes.' }
  }

  // Cambiar el alcance con cuentas asignadas dejaría ramas/células incoherentes.
  if (datos.data.alcance !== actual.alcance && (await contarUsuariosDeRol(rolId)) > 0) {
    return {
      ok: false,
      error: 'No se puede cambiar el alcance de un rol con cuentas. Muévelas antes a otro rol.',
    }
  }

  try {
    await actualizarRol(rolId, datos.data)
  } catch (e) {
    const mensaje = errorDeMySQL(e)
    if (mensaje) return { ok: false, error: mensaje }
    throw e
  }

  // Los cambios se aplican de inmediato: los permisos se leen de la base en cada petición.
  revalidatePath('/panel', 'layout')
  return { ok: true }
}

export async function borrarRol(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const rolId = Number(formData.get('id'))
  if (!Number.isInteger(rolId) || rolId <= 0) return { ok: false, error: 'Rol no válido.' }

  const permiso = await exigirPermisoAccion('eliminar', 'rol')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const actual = await buscarRol(rolId)
  if (!actual) return { ok: false, error: 'El rol ya no existe.' }
  if (actual.esSistema) return { ok: false, error: 'El rol Administrador no se puede borrar.' }
  if (!puedeOtorgar(permiso.usuario, actual)) {
    return { ok: false, error: 'No puedes borrar un rol con más permisos o más alcance que el tuyo.' }
  }

  const enUso = await contarUsuariosDeRol(rolId)
  if (enUso > 0) {
    return {
      ok: false,
      error: `No se puede borrar: ${enUso} ${enUso === 1 ? 'cuenta usa' : 'cuentas usan'} este rol. Cámbialas a otro rol primero.`,
    }
  }

  try {
    await eliminarRol(rolId)
  } catch (e) {
    const mensaje = errorDeMySQL(e)
    if (mensaje) return { ok: false, error: mensaje }
    throw e
  }

  revalidatePath('/panel/roles')
  return { ok: true }
}
