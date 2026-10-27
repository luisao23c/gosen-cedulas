import { consultarUno, ejecutar } from '@/lib/db/conexion'

/**
 * Acceso a datos de `intento_login`: los inicios de sesión fallidos recientes.
 *
 * Se usa el reloj de la base (NOW()) para escribir y para comparar, así no importa en qué
 * zona horaria o instancia corra la aplicación.
 */

/** Fallos de esa clave («c:correo» o «i:ip») en los últimos `minutos`. */
export async function contarFallos(clave: string, minutos: number): Promise<number> {
  const fila = await consultarUno<{ total: number | string }>(
    `SELECT COUNT(*) AS total FROM intento_login
      WHERE clave = ? AND creado_en > NOW() - INTERVAL ? MINUTE`,
    [clave, minutos],
  )
  return Number(fila?.total ?? 0)
}

/** Anota un fallo para cada clave y de paso barre lo que ya no cuenta (más de un día). */
export async function anotarFallo(claves: string[]): Promise<void> {
  if (claves.length === 0) return
  await ejecutar(
    `INSERT INTO intento_login (clave) VALUES ${claves.map(() => '(?)').join(', ')}`,
    claves,
  )
  await ejecutar(`DELETE FROM intento_login WHERE creado_en < NOW() - INTERVAL 1 DAY`)
}

/** Tras un inicio de sesión correcto, el correo vuelve a empezar de cero. */
export async function olvidarFallos(clave: string): Promise<void> {
  await ejecutar(`DELETE FROM intento_login WHERE clave = ?`, [clave])
}
