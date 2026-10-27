#!/usr/bin/env node
/**
 * Migra una base de datos EXISTENTE del modelo antiguo (columna fija
 * `usuario.rol` = ADMIN / LIDER_RAMA / LIDER_CEDULA) al modelo de roles y
 * permisos configurables (tablas `rol` y `rol_permiso` + `usuario.rol_id`).
 *
 *   npm run db:migrar-roles
 *
 * A diferencia de `npm run db:setup`, NO borra datos: conserva usuarios,
 * ramas y células, y deja a cada cuenta con el rol equivalente. Es seguro
 * volver a ejecutarlo (si ya está migrada, no hace nada).
 *
 * Recomendado antes de tocar datos reales:  mysqldump gosen > respaldo.sql
 */

import mysql from 'mysql2/promise'
import { configuracionAdmin } from './conexion-admin.mjs'
import { asegurarRolesBase } from './roles-base.mjs'

const CONFIG = configuracionAdmin()

/**
 * Equivalencia entre el enum antiguo y los roles base nuevos.
 * OJO: las claves son los valores REALES del enum antiguo en la base
 * (`LIDER_CEDULA`, con la ortografía de entonces). No se renombran: si se
 * cambiaran, el UPDATE no encontraría ninguna cuenta que migrar.
 */
const EQUIVALENCIA = {
  ADMIN: 'Administrador',
  LIDER_RAMA: 'Líder de rama',
  LIDER_CEDULA: 'Líder de célula',
}

function log(...args) {
  console.log('[db:migrar-roles]', ...args)
}

async function existeColumna(conexion, tabla, columna) {
  const [filas] = await conexion.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [CONFIG.database, tabla, columna],
  )
  return filas.length > 0
}

async function main() {
  const conexion = await mysql.createConnection(CONFIG)

  if (await existeColumna(conexion, 'usuario', 'rol_id')) {
    log('la base ya usa roles configurables: no hay nada que migrar.')
    await conexion.end()
    return
  }
  if (!(await existeColumna(conexion, 'usuario', 'rol'))) {
    throw new Error('No se encuentra la tabla usuario con el modelo antiguo. ¿Es la base correcta?')
  }

  // Esta es la copia de las tablas de esquema.sql para bases ya existentes:
  // si cambias una, cambia la otra.
  await conexion.query(`
    CREATE TABLE IF NOT EXISTS rol (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nombre      VARCHAR(60)  NOT NULL,
      descripcion VARCHAR(200) NULL,
      alcance     ENUM('ORGANIZACION','RAMA','CELULA') NOT NULL,
      es_sistema  TINYINT(1)   NOT NULL DEFAULT 0,
      creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_rol_nombre (nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  await conexion.query(`
    CREATE TABLE IF NOT EXISTS rol_permiso (
      rol_id  INT UNSIGNED NOT NULL,
      recurso VARCHAR(30)  NOT NULL,
      accion  VARCHAR(30)  NOT NULL,
      PRIMARY KEY (rol_id, recurso, accion),
      CONSTRAINT fk_rolpermiso_rol FOREIGN KEY (rol_id) REFERENCES rol (id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  log('tablas rol y rol_permiso listas')

  const roles = await asegurarRolesBase(conexion)
  log('roles base:', [...roles.keys()].join(', '))

  // Nueva columna, aún sin obligatoriedad, para poder rellenarla
  await conexion.query('ALTER TABLE usuario ADD COLUMN rol_id INT UNSIGNED NULL AFTER contrasena_hash')

  for (const [enumAntiguo, nombre] of Object.entries(EQUIVALENCIA)) {
    const [resultado] = await conexion.query('UPDATE usuario SET rol_id = ? WHERE rol = ?', [
      roles.get(nombre),
      enumAntiguo,
    ])
    log(`${enumAntiguo} → «${nombre}»: ${resultado.affectedRows} cuenta(s)`)
  }

  // Los líderes de célula deben llevar también su rama (para que su líder de
  // rama los vea). Las cuentas creadas desde la interfaz antigua no la tenían.
  await conexion.query(
    `UPDATE usuario u JOIN celula c ON c.id = u.celula_id
        SET u.rama_id = c.rama_id
      WHERE u.rama_id IS NULL`,
  )

  await conexion.query(`
    ALTER TABLE usuario
      MODIFY rol_id INT UNSIGNED NOT NULL,
      ADD KEY idx_usuario_rol (rol_id),
      ADD CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES rol (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
      DROP COLUMN rol`)

  log('migración completada. Ya puedes editar roles y permisos desde /panel/roles.')
  await conexion.end()
}

main().catch((error) => {
  console.error('[db:migrar-roles] error:', error.message)
  process.exitCode = 1
})
