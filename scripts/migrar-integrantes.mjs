#!/usr/bin/env node
/**
 * Crea la tabla `integrante` en una base EXISTENTE, sin borrar datos.
 *
 *   npm run db:migrar-integrantes
 *
 * La crea con la forma ACTUAL (ubicación por mapa, sin domicilio ni correo).
 * Si la base venía del modelo antiguo, después hay que pasar
 * `npm run db:migrar-ubicaciones`, que convierte el domicilio en `direccion`
 * antes de retirarlo.
 *
 * `npm run db:setup` reinicia todo el esquema (y los datos), así que no sirve
 * para una instalación en uso. Este script es idempotente: si la tabla ya
 * existe, no hace nada.
 *
 * Crea la tabla con el usuario ROOT (igual que `db:migrar-roles`): el usuario
 * de la aplicación tiene SELECT/INSERT/UPDATE/DELETE, pero no DDL.
 *
 * Si MySQL responde «CREATE command denied…», revisa DB_USUARIO_ROOT y
 * DB_CONTRASENA_ROOT, o ejecuta esta sentencia como root:
 *   GRANT CREATE, ALTER, INDEX ON `gosen`.* TO 'gosen'@'localhost';
 */

import mysql from 'mysql2/promise'

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: process.env.DB_USUARIO_ROOT ?? 'root',
  password: process.env.DB_CONTRASENA_ROOT ?? '',
  database: process.env.DB_NOMBRE ?? 'gosen',
}

function log(...args) {
  console.log('[db:migrar-integrantes]', ...args)
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

async function migrar(conexion) {

  // Esta definición es la misma de esquema.sql: si cambias una, cambia la otra.
  await conexion.query(`
    CREATE TABLE IF NOT EXISTS integrante (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      celula_id        INT UNSIGNED NOT NULL,
      nombre           VARCHAR(120) NOT NULL,
      apellido_paterno VARCHAR(120) NOT NULL,
      apellido_materno VARCHAR(120) NULL,
      fecha_nacimiento DATE         NULL,
      latitud          DECIMAL(10,7) NULL,
      longitud         DECIMAL(10,7) NULL,
      direccion        VARCHAR(300)  NULL,
      origen_ciudad    VARCHAR(120) NULL,
      origen_estado    VARCHAR(120) NULL,
      hizo_encuentro   TINYINT(1)   NOT NULL DEFAULT 0,
      fecha_encuentro  DATE         NULL,
      bautizado        TINYINT(1)   NOT NULL DEFAULT 0,
      fecha_bautizo    DATE         NULL,
      situacion        ENUM('ACTIVO','VISITANTE','INACTIVO','EGRESADO') NOT NULL DEFAULT 'ACTIVO',
      telefono         VARCHAR(30)  NULL,
      notas            VARCHAR(1000) NULL,
      creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en   DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_integrante_celula (celula_id),
      KEY idx_integrante_nombre (apellido_paterno, apellido_materno, nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  // La clave ajena puede faltar si alguien creó la tabla a mano.
  const [claves] = await conexion.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'integrante'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [CONFIG.database],
  )
  if (claves.length === 0) {
    await conexion.query(`
      ALTER TABLE integrante
        ADD CONSTRAINT fk_integrante_celula FOREIGN KEY (celula_id) REFERENCES celula (id)
          ON DELETE CASCADE ON UPDATE CASCADE`)
    log('clave ajena integrante → celula añadida')
  }

  log('tabla integrante lista.')
}

main().catch((error) => {
  console.error('[db:migrar-integrantes] error:', error.message)
  process.exitCode = 1
})
