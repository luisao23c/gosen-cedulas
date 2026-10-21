/**
 * Sesión del usuario: cookie httpOnly firmada con HMAC.
 *
 * El token no guarda datos del usuario, solo su id + caducidad + firma:
 * cualquier cambio invalida el token. El usuario se recarga de la base
 * en cada petición, así que desactivar una cuenta expulsa de inmediato.
 */

import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { buscarPorId } from '@/lib/db/usuarios'
import type { Usuario } from '@/types/domain'

const CLAVE_COOKIE = 'gosen_sesion'
const DURACION_SEGUNDOS = 60 * 60 * 24 * 7 // 7 días

const SECRETO =
  process.env.SECRETO_SESION ??
  'gosen-desarrollo-no-usar-en-produccion-cambiar-en-env'

if (process.env.NODE_ENV === 'production' && !process.env.SECRETO_SESION) {
  console.warn('[sesión] Falta SECRETO_SESION en el entorno de producción.')
}

function firmar(texto: string): string {
  return createHmac('sha256', SECRETO).update(texto).digest('base64url')
}

function crearToken(usuarioId: number): string {
  const caduca = Math.floor(Date.now() / 1000) + DURACION_SEGUNDOS
  const base = `${usuarioId}.${caduca}`
  return `${base}.${firmar(base)}`
}

/** Devuelve el id del usuario si el token es válido y no ha caducado. */
function leerToken(token: string): number | null {
  const partes = token.split('.')
  if (partes.length !== 3) return null

  const base = `${partes[0]}.${partes[1]}`
  const firma = partes[2]
  const esperada = firmar(base)

  const a = Buffer.from(firma)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const caduca = Number(partes[1])
  if (!Number.isFinite(caduca) || caduca * 1000 < Date.now()) return null

  const id = Number(partes[0])
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Crea la sesión (llamar solo desde una Server Action o Route Handler). */
export async function crearSesion(usuario: Usuario): Promise<void> {
  const almacen = await cookies()
  almacen.set(CLAVE_COOKIE, crearToken(usuario.id), {
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

  const id = leerToken(token)
  if (id === null) return null

  return buscarPorId(id)
}
