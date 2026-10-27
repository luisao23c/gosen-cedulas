#!/usr/bin/env node
/**
 * Crea las tablas `reunion` y `asistencia` (el pase de lista) en una base
 * EXISTENTE, sin borrar datos.
 *
 *   npm run db:migrar-asistencia
 *
 * `npm run db:setup` reinicia todo el esquema (y los datos), así que no sirve
 * para una instalación en uso. Este script es idempotente: si las tablas ya
 * existen, no hace nada.
 *
 * Usa el usuario ROOT (igual que `db:migrar-roles`): el usuario de la
 * aplicación tiene SELECT/INSERT/UPDATE/DELETE, pero no DDL.
 *
 * Si MySQL responde «CREATE command denied…», revisa DB_USUARIO_ROOT y
 * DB_CONTRASENA_ROOT, o ejecuta como root:
 *   GRANT CREATE, ALTER, INDEX, REFERENCES ON `gosen`.* TO 'gosen'@'localhost';
 */

import mysql from 'mysql2/promise'
import { configuracionAdmin } from './conexion-admin.mjs'

const CONFIG = configuracionAdmin()

function log(...args) {
  console.log('[db:migrar-asistencia]', ...args)
}

async function main() {
  const conexion = await mysql.createConnection(CONFIG)
  try {
    await migrar(conexion)
  } finally {
    // Sin esto, un error deja el socket abierto y el proceso no termina.
    await conexion.end().catch(() => undefined)
  }
}

async function existeTabla(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [CONFIG.database, tabla],
  )
  return filas.length > 0
}

async function clavesAjenas(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [CONFIG.database, tabla],
  )
  return filas.map((fila) => fila.CONSTRAINT_NAME)
}

async function migrar(conexion) {
  // Sin `celula` no tiene sentido: la reunión cuelga de ella.
  for (const tabla of ['celula', 'integrante']) {
    if (!(await existeTabla(conexion, tabla))) {
      log(`⚠️  no existe la tabla \`${tabla}\`: ejecuta antes el setup o su migración.`)
      return
    }
  }

  // Esta definición es la misma de esquema.sql: si cambias una, cambia la otra.
  await conexion.query(`
    CREATE TABLE IF NOT EXISTS reunion (
      id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
      celula_id INT UNSIGNED NOT NULL,
      fecha     DATE         NOT NULL,
      creado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reunion_celula_fecha (celula_id, fecha),
      KEY idx_reunion_celula (celula_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      reunion_id    INT UNSIGNED NOT NULL,
      integrante_id INT UNSIGNED NOT NULL,
      estado        ENUM('PRESENTE','AUSENTE','TARDANZA','JUSTIFICADO') NOT NULL DEFAULT 'PRESENTE',
      PRIMARY KEY (id),
      UNIQUE KEY uq_asistencia_reunion_integrante (reunion_id, integrante_id),
      KEY idx_asistencia_integrante (integrante_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  // Las claves ajenas pueden faltar si alguien creó las tablas a mano.
  if ((await clavesAjenas(conexion, 'reunion')).length === 0) {
    await conexion.query(`
      ALTER TABLE reunion
        ADD CONSTRAINT fk_reunion_celula FOREIGN KEY (celula_id) REFERENCES celula (id)
          ON DELETE CASCADE ON UPDATE CASCADE`)
    log('clave ajena reunion → celula añadida')
  }

  if ((await clavesAjenas(conexion, 'asistencia')).length === 0) {
    await conexion.query(`
      ALTER TABLE asistencia
        ADD CONSTRAINT fk_asistencia_reunion FOREIGN KEY (reunion_id) REFERENCES reunion (id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        ADD CONSTRAINT fk_asistencia_integrante FOREIGN KEY (integrante_id) REFERENCES integrante (id)
          ON DELETE CASCADE ON UPDATE CASCADE`)
    log('claves ajenas asistencia → reunion e integrante añadidas')
  }

  log('tablas reunion y asistencia listas.')
}

main().catch((error) => {
  console.error('[db:migrar-asistencia] error:', error.message)
  process.exitCode = 1
})
