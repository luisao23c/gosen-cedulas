/**
 * Política de intentos de inicio de sesión (lógica pura).
 *
 * Los intentos fallidos se cuentan por CORREO y por IP en una ventana de tiempo. Cuenta
 * aunque el correo no exista: así el bloqueo no delata qué correos están registrados.
 * Los contadores viven en la base (`intento_login`), no en memoria, porque en un servicio
 * sin servidor (Vercel) cada petición puede caer en una instancia distinta.
 */

export interface PoliticaLogin {
  /** Cuánto tiempo se recuerda un intento fallido */
  ventanaMinutos: number
  /** Fallos permitidos para un mismo correo dentro de la ventana */
  maxPorCorreo: number
  /** Fallos permitidos desde una misma IP dentro de la ventana (más holgado: varias personas comparten red) */
  maxPorIp: number
}

export const POLITICA_LOGIN: PoliticaLogin = { ventanaMinutos: 15, maxPorCorreo: 5, maxPorIp: 30 }

export function estaBloqueado(
  fallos: { porCorreo: number; porIp: number },
  politica: PoliticaLogin = POLITICA_LOGIN,
): boolean {
  return fallos.porCorreo >= politica.maxPorCorreo || fallos.porIp >= politica.maxPorIp
}

export function mensajeDeBloqueo(politica: PoliticaLogin = POLITICA_LOGIN): string {
  return `Demasiados intentos fallidos. Espera ${politica.ventanaMinutos} minutos y vuelve a intentarlo.`
}

/** Minimo de lo que necesitamos de las cabeceras (así se prueba sin Next). */
interface Cabeceras {
  get(nombre: string): string | null
}

/**
 * IP del cliente según el proxy (en Vercel la pone la plataforma). Devuelve null si no hay una
 * dirección con forma de IP: en ese caso no se cuenta por IP, para no mezclar a todos en un solo contador.
 */
export function ipDeCabeceras(cabeceras: Cabeceras): string | null {
  const candidata = (cabeceras.get('x-forwarded-for')?.split(',')[0] ?? cabeceras.get('x-real-ip') ?? '').trim()
  return candidata.length > 0 && candidata.length <= 45 && /^[0-9a-fA-F:.]+$/.test(candidata) ? candidata : null
}
