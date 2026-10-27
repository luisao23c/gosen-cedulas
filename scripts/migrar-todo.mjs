#!/usr/bin/env node
/**
 * Pone una base EXISTENTE al día: ejecuta todas las migraciones, una detrás de otra.
 *
 *   npm run db:migrar-todo
 *
 * Todas son idempotentes (lo que ya está hecho no se repite) y no borran datos, así que se
 * puede correr en cada despliegue. Se detiene en la primera que falle.
 *
 * MySQL propio → usa root (DB_USUARIO_ROOT / DB_CONTRASENA_ROOT).
 * Base gestionada (Aiven…) → DB_REMOTA=true y DB_SSL=true con la cuenta del proveedor.
 * (Ver DESPLIEGUE.md.)
 */

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CARPETA = dirname(fileURLToPath(import.meta.url))

// El orden importa: `celulas` renombra la tabla antigua que otras migraciones esperan ya con su nombre nuevo
const MIGRACIONES = ['roles', 'celulas', 'integrantes', 'ubicaciones', 'asistencia', 'ministerio', 'campos', 'seguridad']

for (const nombre of MIGRACIONES) {
  console.log(`\n[db:migrar-todo] ▶ ${nombre}`)
  const resultado = spawnSync(process.execPath, [join(CARPETA, `migrar-${nombre}.mjs`)], {
    stdio: 'inherit',
    env: process.env,
  })
  if (resultado.status !== 0) {
    console.error(`\n[db:migrar-todo] ✖ falló «${nombre}»: no se ejecutaron las siguientes.`)
    process.exit(resultado.status ?? 1)
  }
}
console.log('\n[db:migrar-todo] ✔ la base está al día.')
