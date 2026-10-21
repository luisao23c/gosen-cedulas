import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getUsuarioActual } from '@/lib/auth/sesion'
import { puede, rolPuede, type Accion, type Ambito, type Recurso } from '@/lib/auth/permisos'
import type { Usuario } from '@/types/domain'

/**
 * Guardas de servidor. Se usan al ENTRAR a una página y DENTRO de cada
 * server action: la interfaz puede maquillarse, esto no.
 */

/** Usuario autenticado o redirección al login. */
export async function exigirSesion(): Promise<Usuario> {
  // Marca la ruta como dinámica ANTES de leer la sesión: comprobar la
  // caducidad del token usa la hora actual, que no es prerenderizable.
  await connection()

  const usuario = await getUsuarioActual()
  if (!usuario) redirect('/login')
  return usuario
}

/** Sesión + permiso sobre un recurso y ámbito concretos. */
export async function exigirPermiso(
  accion: Accion,
  recurso: Recurso,
  ambito: Ambito = {},
): Promise<Usuario> {
  const usuario = await exigirSesion()
  if (!puede(usuario, accion, recurso, ambito)) {
    redirect('/panel/acceso-denegado')
  }
  return usuario
}

/**
 * Guarda para PÁGINAS DE LISTADO: comprueba solo el permiso del rol.
 * El alcance (una rama concreta, una célula concreta) se aplica DENTRO del SQL,
 * porque en un listado todavía no hay un objeto concreto del que colgar.
 */
export async function exigirRol(accion: Accion, recurso: Recurso): Promise<Usuario> {
  const usuario = await exigirSesion()
  if (!rolPuede(usuario, accion, recurso)) {
    redirect('/panel/acceso-denegado')
  }
  return usuario
}

/**
 * Guarda para server actions: devuelve un error en lugar de redirigir,
 * porque el formulario necesita ver el mensaje.
 */
export async function exigirPermisoAccion(
  accion: Accion,
  recurso: Recurso,
  ambito: Ambito = {},
): Promise<{ usuario: Usuario } | { error: string }> {
  const usuario = await getUsuarioActual()
  if (!usuario) return { error: 'Tu sesión ha caducado. Vuelve a entrar.' }
  if (!puede(usuario, accion, recurso, ambito)) {
    return { error: 'No tienes permiso para hacer eso.' }
  }
  return { usuario }
}
