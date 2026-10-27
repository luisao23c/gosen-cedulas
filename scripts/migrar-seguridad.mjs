#!/usr/bin/env node
/**
 * Crea la tabla `intento_login` (límite de intentos de inicio de sesión) en una base
 * EXISTENTE, sin borrar datos.
 *
 *   npm run db:migrar-seguridad
 *
 * Es idempotente. Sin la tabla, la aplicación sigue funcionando pero SIN límite de
 * intentos (y lo avisa en el registro).
 *
 * MySQL propio: usa el usuario ROOT (DB_USUARIO_ROOT / DB_CONTRASENA_ROOT), porque el
 * usuario de la aplicación no tiene permiso para crear tablas.
 * Base gestionada (Aiven, TiDB…): DB_REMOTA=true y DB_SSL=true usan la cuenta del proveedor
 * (DB_USUARIO / DB_CONTRASENA), igual que `npm run db:setup`.
 */

import mysql from 'mysql2/promise'

const REMOTA = process.env.DB_REMOTA === 'true'

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: REMOTA ? (process.env.DB_USUARIO ?? 'gosen') : (process.env.DB_USUARIO_ROOT ?? 'root'),
  password: REMOTA ? (process.env.DB_CONTRASENA ?? '') : (process.env.DB_CONTRASENA_ROOT ?? ''),
  database: process.env.DB_NOMBRE ?? 'gosen',
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
}

function log(...args) {
  console.log('[db:migrar-seguridad]', ...args)
}

async function main() {
  const conexion = await mysql.createConnection(CONFIG)
  try {
    // Misma definición que esquema.sql: si cambias una, cambia la otra.
    await conexion.query(`
      CREATE TABLE IF NOT EXISTS intento_login (
        id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        clave     VARCHAR(220)    NOT NULL,
        creado_en DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_intento_clave (clave, creado_en),
        KEY idx_intento_creado (creado_en)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    log('tabla intento_login lista.')
  } finally {
    await conexion.end().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('[db:migrar-seguridad] error:', error.message)
  process.exitCode = 1
})
