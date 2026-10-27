/**
 * Sesión del usuario: cookie httpOnly firmada con HMAC (ver `token.ts`).
 *
 * El token no guarda datos del usuario, solo su id + caducidad + firma:
 * cualquier cambio invalida el token. El usuario se recarga de la base
 * en cada petición, así que desactivar una cuenta expulsa de inmediato.
 *
 * El secreto sale de `entorno.ts`: en producción, sin `SECRETO_SESION` propio la
 * sesión NO funciona (falla cerrado) en vez de firmar con un secreto público.
 */

import { cookies } from 'next/headers'
import { buscarPorId } from '@/lib/db/usuarios'
import { secretoSesion } from '@/lib/entorno'
import { DURACION_SEGUNDOS, crearToken, leerToken } from '@/lib/auth/token'
import type { Usuario } from '@/types/domain'

const CLAVE_COOKIE = 'gosen_sesion'

/** Crea la sesión (llamar solo desde una Server Action o Route Handler). */
export async function crearSesion(usuario: Usuario): Promise<void> {
  const almacen = await cookies()
  almacen.set(CLAVE_COOKIE, crearToken(usuario.id, secretoSesion()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_SEGUNDOS,
    path: '/',
  })
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies()
  almacen.delete(CLAVE_COOKIE)
}

/**
 * Usuario de la petición actual, o null si no hay sesión válida.
 * Se consulta la base: no se confía en nada que venga del cliente.
 * Comprueba la caducidad con la hora actual, por eso las páginas del panel
 * se exportan con `instant = false` (se renderizan por petición, sin prerender).
 */
export async function getUsuarioActual(): Promise<Usuario | null> {
  const almacen = await cookies()
  const token = almacen.get(CLAVE_COOKIE)?.value
  if (!token) return null

  const id = leerToken(token, secretoSesion())
  if (id === null) return null

  return buscarPorId(id)
}
