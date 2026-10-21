'use server'

import { revalidatePath } from 'next/cache'
import { esquemaUsuario, esquemaUsuarioEdicion, primerError } from '@/lib/validaciones'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import { puedeOtorgar } from '@/lib/auth/permisos'
import {
  crearUsuario,
  actualizarUsuario,
  buscarParaEdicion,
  contarAdministradoresActivos,
  cambiarContrasena,
} from '@/lib/db/usuarios'
import { buscarRol } from '@/lib/db/roles'
import { ramaDeCelula } from '@/lib/db/ramas'
import { hashContrasena } from '@/lib/auth/contrasenas'
import type { Rol } from '@/types/domain'
import type { EstadoFormulario } from '@/features/tipos'

function errorDeMySQL(error: unknown): string | null {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === 'ER_DUP_ENTRY') return 'Ya existe una cuenta con ese correo.'
  if (codigo === 'ER_NO_REFERENCED_ROW_2') return 'El rol, la rama o la célula indicada no existe.'
  return null
}

/**
 * Coherencia obligatoria entre el alcance del rol y lo que se asigna a la cuenta.
 * Devuelve el error, o lo que realmente se guardará (lo que el rol no usa se
 * descarta: una cuenta de organización no queda atada a una rama ni a un
 * ministerio).
 */
async function resolverAlcance(
  rol: Rol,
  ramaId: number | null,
  celulaId: number | null,
  ministerioId: number | null,
): Promise<
  { error: string } | { ramaId: number | null; celulaId: number | null; ministerioId: number | null }
> {
  if (rol.alcance === 'RAMA') {
    if (ramaId == null) return { error: 'Este rol necesita una rama asignada.' }
    return { ramaId, celulaId: null, ministerioId: null }
  }
  if (rol.alcance === 'CELULA') {
    if (celulaId == null) return { error: 'Este rol necesita una célula asignada.' }
    // La rama se deduce de la célula: así el líder de rama ve a los de sus células.
    const rama = await ramaDeCelula(celulaId)
    if (rama == null) return { error: 'La célula indicada no existe.' }
    return { ramaId: rama, celulaId, ministerioId: null }
  }
  if (rol.alcance === 'MINISTERIO') {
    if (ministerioId == null) return { error: 'Este rol necesita un ministerio asignado.' }
    return { ramaId: null, celulaId: null, ministerioId }
  }
  return { ramaId: null, celulaId: null, ministerioId: null }
}

const MENSAJE_ESCALADA = 'No puedes asignar un rol con más permisos o más alcance que el tuyo.'

export async function guardarUsuario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const permiso = await exigirPermisoAccion('crear', 'usuario')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const datos = esquemaUsuario.safeParse({
    email: formData.get('email'),
    nombre: formData.get('nombre'),
    contrasena: formData.get('contrasena'),
    rolId: formData.get('rolId'),
    ramaId: formData.get('ramaId'),
    celulaId: formData.get('celulaId'),
    ministerioId: formData.get('ministerioId'),
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  const rol = await buscarRol(datos.data.rolId)
  if (!rol) return { ok: false, error: 'El rol elegido ya no existe.' }
  if (!puedeOtorgar(permiso.usuario, rol)) return { ok: false, error: MENSAJE_ESCALADA }

  const alcance = await resolverAlcance(
    rol,
    datos.data.ramaId,
    datos.data.celulaId,
    datos.data.ministerioId,
  )
  if ('error' in alcance) return { ok: false, error: alcance.error }

  const contrasenaHash = await hashContrasena(datos.data.contrasena)

  try {
    await crearUsuario({
      email: datos.data.email,
      nombre: datos.data.nombre,
      contrasenaHash,
      rolId: rol.id,
      ramaId: alcance.ramaId,
      celulaId: alcance.celulaId,
      ministerioId: alcance.ministerioId,
    })
  } catch (e) {
    const mensaje = errorDeMySQL(e)
    if (mensaje) return { ok: false, error: mensaje }
    throw e
  }

  revalidatePath('/panel/usuarios')
  revalidatePath('/panel/roles')
  return { ok: true }
}

export async function editarUsuario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuarioId = Number(formData.get('id'))
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return { ok: false, error: 'Usuario no válido.' }
  }

  const permiso = await exigirPermisoAccion('editar', 'usuario')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const datos = esquemaUsuarioEdicion.safeParse({
    nombre: formData.get('nombre'),
    rolId: formData.get('rolId'),
    ramaId: formData.get('ramaId'),
    celulaId: formData.get('celulaId'),
    ministerioId: formData.get('ministerioId'),
    activa: formData.get('activa') === 'on' ? 'true' : '',
    contrasena: formData.get('contrasena'),
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  // El objetivo y el rol se comprueban contra la base: nunca confíes en lo que manda el cliente.
  const objetivo = await buscarParaEdicion(usuarioId)
  if (!objetivo) return { ok: false, error: 'La cuenta indicada ya no existe.' }

  const rol = await buscarRol(datos.data.rolId)
  if (!rol) return { ok: false, error: 'El rol elegido ya no existe.' }

  // No se puede tocar a quien tiene más poder que uno, ni subirse de rol.
  if (!puedeOtorgar(permiso.usuario, objetivo) || !puedeOtorgar(permiso.usuario, rol)) {
    return { ok: false, error: MENSAJE_ESCALADA }
  }

  const alcance = await resolverAlcance(
    rol,
    datos.data.ramaId,
    datos.data.celulaId,
    datos.data.ministerioId,
  )
  if ('error' in alcance) return { ok: false, error: alcance.error }

  // Invariante: la organización nunca puede quedarse sin administrador activo
  // (cubre la baja propia y la de cualquier otro admin, y el cambio de rol).
  const pierdeAdmin = objetivo.esAdmin && objetivo.activo && (!datos.data.activa || !rol.esSistema)
  if (pierdeAdmin && (await contarAdministradoresActivos(objetivo.id)) === 0) {
    return {
      ok: false,
      error:
        'Debe quedar al menos un administrador activo: no se puede dar de baja ni degradar al último.',
    }
  }

  try {
    await actualizarUsuario(usuarioId, {
      nombre: datos.data.nombre,
      rolId: rol.id,
      ramaId: alcance.ramaId,
      celulaId: alcance.celulaId,
      ministerioId: alcance.ministerioId,
      activo: datos.data.activa,
    })
    // Reset opcional de contraseña (vacío = no tocarla)
    if (datos.data.contrasena) {
      await cambiarContrasena(usuarioId, await hashContrasena(datos.data.contrasena))
    }
  } catch (e) {
    const mensaje = errorDeMySQL(e)
    if (mensaje) return { ok: false, error: mensaje }
    throw e
  }

  revalidatePath('/panel/usuarios')
  revalidatePath('/panel/roles')
  return { ok: true }
}
