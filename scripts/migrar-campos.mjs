#!/usr/bin/env node
/**
 * Pone el catálogo de CAMPOS DIFERENCIADORES en una base EXISTENTE, sin borrar datos:
 *
 *   · tablas `campo`, `campo_opcion`, `integrante_respuesta`, `celula_criterio`
 *     y `celula_criterio_opcion`
 *   · el permiso `campo:ver` para los roles que ya gestionan células (así la
 *     ficha de la célula puede mostrar el catálogo para declarar criterios)
 *   · siembra dos campos de ejemplo si la tabla está vacía: «Estado civil»
 *     (opciones: soltero, casado, divorciado…) y «Rango de edad» (numérico)
 *
 *   npm run db:migrar-campos
 *
 * Es idempotente. Usa el usuario ROOT (como las demás migraciones): el usuario
 * de la aplicación tiene DML, pero no DDL.
 *
 * Los criterios de cada célula NO se siembran: se declaran desde la ficha de
 * la célula (/panel/celulas/[id]), y las respuestas se toman en Lobby o en la
 * ficha de cada integrante.
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
  console.log('[db:migrar-campos]', ...args)
}

async function main() {
  const conexion = await mysql.createConnection({ ...CONFIG, multipleStatements: true })
  try {
    await migrar(conexion)
  } finally {
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

async function clavesAjenasDe(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [CONFIG.database, tabla],
  )
  return new Set(filas.map((fila) => fila.CONSTRAINT_NAME))
}

/** Añade una clave ajena si no existe (con el nombre dado). */
async function agregarClaveAjena(conexion, tabla, nombre, definicion) {
  const existentes = await clavesAjenasDe(conexion, tabla)
  if (existentes.has(nombre)) return false
  await conexion.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${nombre}\` ${definicion}`)
  return true
}

/** Campos de ejemplo: solo si la tabla está vacía (una instalación real ya tiene lo suyo). */
const CAMPOS_DE_EJEMPLO = [
  {
    nombre: 'Estado civil',
    tipo: 'SELECT',
    descripcion: 'Estado civil de la persona, para agruparla con quien vive lo mismo.',
    opciones: ['Soltero', 'Casado', 'Divorciado', 'Viudo'],
  },
  {
    nombre: 'Edad',
    tipo: 'RANGO',
    descripcion: 'Años cumplidos de la persona.',
    unidad: 'años',
    limiteInferior: 0,
    limiteSuperior: 120,
  },
]

async function sembrarCamposDeEjemplo(conexion) {
  const [existentes] = await conexion.query('SELECT COUNT(*) AS n FROM campo')
  if (Number(existentes[0]?.n ?? 0) > 0) return

  for (const [indice, campo] of CAMPOS_DE_EJEMPLO.entries()) {
    const [resultado] = await conexion.query(
      'INSERT INTO campo (nombre, tipo, descripcion, unidad, limite_inferior, limite_superior, orden) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        campo.nombre,
        campo.tipo,
        campo.descripcion,
        campo.unidad ?? null,
        campo.limiteInferior ?? null,
        campo.limiteSuperior ?? null,
        indice,
      ],
    )
    for (const [posicion, etiqueta] of (campo.opciones ?? []).entries()) {
      await conexion.query(
        'INSERT INTO campo_opcion (campo_id, etiqueta, orden) VALUES (?, ?, ?)',
        [resultado.insertId, etiqueta, posicion],
      )
    }
    log(`campo de ejemplo: ${campo.nombre}`)
  }
}

/** `campo:ver` para los roles que ya gestionan células (deciden sus criterios). */
async function concederVerCatalogo(conexion) {
  const [roles] = await conexion.query(
    `SELECT DISTINCT rp.rol_id FROM rol_permiso rp
      WHERE rp.recurso = 'celula' AND rp.accion = 'editar'`,
  )
  let agregados = 0
  for (const rol of roles) {
    const [hecho] = await conexion.query(
      `SELECT 1 FROM rol_permiso WHERE rol_id = ? AND recurso = 'campo' AND accion = 'ver'`,
      [rol.rol_id],
    )
    if (hecho.length > 0) continue
    await conexion.query(
      'INSERT INTO rol_permiso (rol_id, recurso, accion) VALUES (?, ?, ?)',
      [rol.rol_id, 'campo', 'ver'],
    )
    agregados += 1
  }
  return agregados
}

async function migrar(conexion) {
  for (const tabla of ['usuario', 'celula', 'integrante']) {
    if (!(await existeTabla(conexion, tabla))) {
      log(`⚠️  no existe la tabla \`${tabla}\`: ¿es la base correcta?`)
      return
    }
  }

  /* ── 1) Las tablas del catálogo (mismas que esquema.sql) ────── */
  await conexion.query(`
    CREATE TABLE IF NOT EXISTS campo (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nombre          VARCHAR(120) NOT NULL,
      tipo            ENUM('SELECT','RANGO') NOT NULL DEFAULT 'SELECT',
      descripcion     VARCHAR(300) NULL,
      unidad          VARCHAR(30)  NULL,
      limite_inferior INT NULL,
      limite_superior INT NULL,
      activo          TINYINT(1)   NOT NULL DEFAULT 1,
      orden           INT          NOT NULL DEFAULT 0,
      creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_campo_nombre (nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS campo_opcion (
      id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
      campo_id INT UNSIGNED NOT NULL,
      etiqueta VARCHAR(120) NOT NULL,
      orden    INT          NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_campo_opcion (campo_id, etiqueta),
      KEY idx_campo_opcion_campo (campo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS integrante_respuesta (
      integrante_id INT UNSIGNED NOT NULL,
      campo_id      INT UNSIGNED NOT NULL,
      opcion_id     INT UNSIGNED NULL,
      valor         INT          NULL,
      PRIMARY KEY (integrante_id, campo_id),
      KEY idx_respuesta_campo (campo_id),
      KEY idx_respuesta_opcion (opcion_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS celula_criterio (
      celula_id   INT UNSIGNED NOT NULL,
      campo_id    INT UNSIGNED NOT NULL,
      obligatorio TINYINT(1)   NOT NULL DEFAULT 1,
      minimo      INT          NULL,
      maximo      INT          NULL,
      PRIMARY KEY (celula_id, campo_id),
      KEY idx_criterio_campo (campo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS celula_criterio_opcion (
      celula_id  INT UNSIGNED NOT NULL,
      campo_id   INT UNSIGNED NOT NULL,
      opcion_id  INT UNSIGNED NOT NULL,
      PRIMARY KEY (celula_id, campo_id, opcion_id),
      KEY idx_criterio_opcion_opcion (opcion_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  /* ── 2) Claves ajenas ────── */
  const fk = [
    ['campo_opcion', 'fk_campoopcion_campo', 'FOREIGN KEY (campo_id) REFERENCES campo (id) ON DELETE CASCADE ON UPDATE CASCADE'],
    ['integrante_respuesta', 'fk_respuesta_integrante', 'FOREIGN KEY (integrante_id) REFERENCES integrante (id) ON DELETE CASCADE ON UPDATE CASCADE'],
    ['integrante_respuesta', 'fk_respuesta_campo', 'FOREIGN KEY (campo_id) REFERENCES campo (id) ON DELETE CASCADE ON UPDATE CASCADE'],
    ['integrante_respuesta', 'fk_respuesta_opcion', 'FOREIGN KEY (opcion_id) REFERENCES campo_opcion (id) ON DELETE SET NULL ON UPDATE CASCADE'],
    ['celula_criterio', 'fk_criterio_celula', 'FOREIGN KEY (celula_id) REFERENCES celula (id) ON DELETE CASCADE ON UPDATE CASCADE'],
    ['celula_criterio', 'fk_criterio_campo', 'FOREIGN KEY (campo_id) REFERENCES campo (id) ON DELETE CASCADE ON UPDATE CASCADE'],
    ['celula_criterio_opcion', 'fk_criterioopcion_celula', 'FOREIGN KEY (celula_id) REFERENCES celula (id) ON DELETE CASCADE ON UPDATE CASCADE'],
    ['celula_criterio_opcion', 'fk_criterioopcion_campo', 'FOREIGN KEY (campo_id) REFERENCES campo (id) ON DELETE CASCADE ON UPDATE CASCADE'],
    ['celula_criterio_opcion', 'fk_criterioopcion_opcion', 'FOREIGN KEY (opcion_id) REFERENCES campo_opcion (id) ON DELETE CASCADE ON UPDATE CASCADE'],
  ]
  let claves = 0
  for (const [tabla, nombre, definicion] of fk) {
    if (await agregarClaveAjena(conexion, tabla, nombre, definicion)) claves += 1
  }

  /* ── 3) Permisos y datos de ejemplo ────── */
  await sembrarCamposDeEjemplo(conexion)
  const permisos = await concederVerCatalogo(conexion)

  log(`listo · claves ajenas nuevas: ${claves} · roles con «campo:ver»: ${permisos}`)
  log('los criterios de cada célula se declaran en su ficha; las respuestas, en Lobby.')
}

main().catch((error) => {
  console.error('[db:migrar-campos] falló:', error.message)
  process.exitCode = 1
})
