import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Token de sesión: `id.caducidad.firma`, con firma HMAC-SHA256.
 *
 * No guarda datos del usuario, solo su id y cuándo caduca: cualquier cambio invalida
 * la firma. Es lógica pura (el secreto y la hora llegan como argumento) para poder
 * probarla sin cookies ni base de datos; `sesion.ts` pone la cookie.
 */

export const DURACION_SEGUNDOS = 60 * 60 * 24 * 7 // 7 días

function firmar(texto: string, secreto: string): string {
  return createHmac('sha256', secreto).update(texto).digest('base64url')
}

export function crearToken(usuarioId: number, secreto: string, ahoraMs: number = Date.now()): string {
  const caduca = Math.floor(ahoraMs / 1000) + DURACION_SEGUNDOS
  const base = `${usuarioId}.${caduca}`
  return `${base}.${firmar(base, secreto)}`
}

/** Devuelve el id del usuario si el token es auténtico y no ha caducado. */
export function leerToken(token: string, secreto: string, ahoraMs: number = Date.now()): number | null {
  const partes = token.split('.')
  if (partes.length !== 3) return null

  const base = `${partes[0]}.${partes[1]}`
  const recibida = Buffer.from(partes[2])
  const esperada = Buffer.from(firmar(base, secreto))
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null

  const caduca = Number(partes[1])
  if (!Number.isFinite(caduca) || caduca * 1000 < ahoraMs) return null

  const id = Number(partes[0])
  return Number.isInteger(id) && id > 0 ? id : null
}
