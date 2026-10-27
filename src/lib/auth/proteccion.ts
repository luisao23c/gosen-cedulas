import { anotarFallo, contarFallos, olvidarFallos } from '@/lib/db/intentos'
import { POLITICA_LOGIN, estaBloqueado } from '@/lib/auth/limite'

/**
 * Protección del inicio de sesión contra adivinar contraseñas: junta la política
 * (`limite.ts`) con los contadores de la base (`db/intentos.ts`).
 *
 * Si la tabla `intento_login` aún no existe (base sin migrar: `npm run db:migrar-seguridad`),
 * el inicio de sesión sigue funcionando SIN límite y se avisa en el registro. Cualquier otro
 * error de base de datos se propaga: si la base falla, el login también falla por su cuenta.
 */

export interface ClavesLogin {
  correo: string
  /** null cuando no se pudo saber la IP: entonces solo se cuenta por correo */
  ip: string | null
}

export function clavesDeLogin(correo: string, ip: string | null): ClavesLogin {
  return { correo: `c:${correo}`, ip: ip ? `i:${ip}` : null }
}

let avisado = false

function codigoDe(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const propio = (error as { code?: unknown }).code
  if (typeof propio === 'string') return propio
  return codigoDe((error as { cause?: unknown }).cause)
}

async function tolerandoTablaFaltante<T>(trabajo: () => Promise<T>, valorSinTabla: T): Promise<T> {
  try {
    return await trabajo()
  } catch (error) {
    if (codigoDe(error) !== 'ER_NO_SUCH_TABLE') throw error
    if (!avisado) {
      avisado = true
      console.warn('[login] Falta la tabla intento_login: el límite de intentos está apagado. Ejecuta: npm run db:migrar-seguridad')
    }
    return valorSinTabla
  }
}

export async function loginBloqueado(claves: ClavesLogin): Promise<boolean> {
  return tolerandoTablaFaltante(async () => {
    const [porCorreo, porIp] = await Promise.all([
      contarFallos(claves.correo, POLITICA_LOGIN.ventanaMinutos),
      claves.ip ? contarFallos(claves.ip, POLITICA_LOGIN.ventanaMinutos) : Promise.resolve(0),
    ])
    return estaBloqueado({ porCorreo, porIp })
  }, false)
}

export async function anotarFalloDeLogin(claves: ClavesLogin): Promise<void> {
  await tolerandoTablaFaltante(
    () => anotarFallo(claves.ip ? [claves.correo, claves.ip] : [claves.correo]),
    undefined,
  )
}

export async function olvidarFallosDeLogin(claves: ClavesLogin): Promise<void> {
  await tolerandoTablaFaltante(() => olvidarFallos(claves.correo), undefined)
}
