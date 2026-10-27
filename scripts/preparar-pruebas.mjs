#!/usr/bin/env node
/**
 * Prepara la base de datos de PRUEBAS (`gosen_test`): esquema limpio + roles base.
 *
 *   npm run db:preparar-pruebas
 *
 * Reutiliza `crear-esquema.mjs` apuntándolo a otra base, así las pruebas
 * automáticas nunca tocan los datos de desarrollo (`gosen`).
 *
 * Seguridad: se niega a correr contra un servidor que no sea local (o el de
 * integración continua), para que una variable `DB_HOST` olvidada en la terminal
 * no borre una base remota.
 */

const NOMBRE = process.env.DB_NOMBRE_PRUEBAS ?? 'gosen_test'
const HOST = process.env.DB_HOST ?? '127.0.0.1'
const ES_LOCAL = ['127.0.0.1', 'localhost', '::1'].includes(HOST)

if (!ES_LOCAL && process.env.CI !== 'true') {
  console.error(
    `[db:preparar-pruebas] Me niego a recrear «${NOMBRE}» en ${HOST}: no es un servidor local.\n` +
      'Quita DB_HOST de la terminal (o usa un MySQL local) y vuelve a intentarlo.',
  )
  process.exit(1)
}
if (process.env.DB_REMOTA === 'true') {
  console.error('[db:preparar-pruebas] DB_REMOTA=true: las pruebas solo corren contra un MySQL propio.')
  process.exit(1)
}
if (!/test/i.test(NOMBRE)) {
  console.error(`[db:preparar-pruebas] El nombre de la base de pruebas debe contener «test» (recibí «${NOMBRE}»).`)
  process.exit(1)
}

process.env.DB_NOMBRE = NOMBRE
await import('./crear-esquema.mjs')
