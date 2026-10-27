/**
 * Variables de entorno que importan para la seguridad.
 *
 * En desarrollo se permite un secreto de ejemplo para que `npm run dev` arranque sin
 * configurar nada. En PRODUCCIÓN no: ese secreto está escrito en el repositorio, y
 * quien lo conoce puede fabricar una sesión válida de cualquier cuenta (incluida la
 * del administrador). Por eso, sin un secreto propio la aplicación se niega a firmar
 * o validar sesiones en vez de avisar y seguir.
 */

export const SECRETO_DE_DESARROLLO = 'gosen-desarrollo-no-usar-en-produccion-cambiar-en-env'
export const LARGO_MINIMO_SECRETO = 32

type Entorno = Record<string, string | undefined>

const COMO_GENERARLO =
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

/** Secreto con el que se firman las sesiones. Lanza un error claro si en producción no es seguro. */
export function secretoSesion(entorno: Entorno = process.env): string {
  const secreto = entorno.SECRETO_SESION?.trim()
  if (entorno.NODE_ENV !== 'production') return secreto || SECRETO_DE_DESARROLLO

  if (!secreto || secreto === SECRETO_DE_DESARROLLO || secreto.length < LARGO_MINIMO_SECRETO) {
    throw new Error(
      `SECRETO_SESION falta o es demasiado corto (mínimo ${LARGO_MINIMO_SECRETO} caracteres). ` +
        `Genera uno con: ${COMO_GENERARLO} y cárgalo en las variables de entorno.`,
    )
  }
  return secreto
}

/** Problemas de configuración que ponen en riesgo una instalación en producción (lista vacía = todo bien). */
export function problemasDeEntorno(entorno: Entorno = process.env): string[] {
  const problemas: string[] = []

  try {
    secretoSesion({ ...entorno, NODE_ENV: 'production' })
  } catch {
    problemas.push('SECRETO_SESION falta o es demasiado corto: las sesiones no se pueden firmar de forma segura.')
  }
  if (!entorno.DB_CONTRASENA || entorno.DB_CONTRASENA === 'gosen_dev' || entorno.DB_CONTRASENA === 'cambia-esto') {
    problemas.push('DB_CONTRASENA es la de ejemplo: usa la contraseña real de la base de datos.')
  }
  const local = ['127.0.0.1', 'localhost', '::1', undefined].includes(entorno.DB_HOST)
  if (!local && entorno.DB_SSL !== 'true') {
    problemas.push('La base de datos es remota y DB_SSL no está en true: la conexión viajaría sin cifrar.')
  }
  return problemas
}
