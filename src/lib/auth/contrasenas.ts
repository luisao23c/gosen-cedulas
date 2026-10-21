import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'

/**
 * Hash de contraseñas con scrypt (nativo de Node, sin dependencias).
 * Formato almacenado: scrypt$N$r$p$salt$hash  (todo en base64url)
 * Los parámetros viajan en el propio texto, así que se pueden cambiar
 * después sin romper las contraseñas ya guardadas.
 */

const LONGITUD_CLAVE = 64

function derivar(
  clave: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(
      clave.normalize('NFKC'),
      salt,
      LONGITUD_CLAVE,
      { N: n, r, p, maxmem: 128 * 1024 * 1024 },
      (error, claveDerivada) => {
        if (error) reject(error)
        else resolve(claveDerivada)
      },
    )
  })
}

/** Devuelve el texto listo para guardar en la base de datos. */
export async function hashContrasena(clave: string): Promise<string> {
  if (clave.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres')
  }
  const n = 16384
  const r = 8
  const p = 1
  const salt = randomBytes(16)
  const derivada = await derivar(clave, salt, n, r, p)
  return `scrypt$${n}$${r}$${p}$${salt.toString('base64url')}$${derivada.toString('base64url')}`
}

/** Compara una contraseña en claro contra el hash guardado. */
export async function verificarContrasena(clave: string, almacenada: string): Promise<boolean> {
  const partes = almacenada.split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false
  const n = Number(partes[1])
  const r = Number(partes[2])
  const p = Number(partes[3])
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  const salt = Buffer.from(partes[4], 'base64url')
  const esperada = Buffer.from(partes[5], 'base64url')
  if (salt.length === 0 || esperada.length !== LONGITUD_CLAVE) return false

  const calculada = await derivar(clave, salt, n, r, p)
  return timingSafeEqual(calculada, esperada)
}
