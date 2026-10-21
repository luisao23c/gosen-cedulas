#!/usr/bin/env node
/**
 * Pone el módulo MINISTERIO en una base EXISTENTE, sin borrar datos:
 *
 *   · tablas `ministerio`, `equipo`, `prestamo`, `evento` y `servidor_evento`
 *   · columna `usuario.ministerio_id` (a qué ministerio pertenece la cuenta)
 *   · el alcance `MINISTERIO` en el enum `rol.alcance`
 *   · los roles base «Encargado de ministerio» y «Servidor de ministerio»
 *   · siembra el primer ministerio («Cámaras») si la tabla está vacía
 *
 *   npm run db:migrar-ministerio
 *
 * Es idempotente. Usa el usuario ROOT (como las demás migraciones): el usuario
 * de la aplicación tiene DML, pero no DDL.
 *
 * Las cuentas del ministerio se crean DESPUÉS, desde /panel/usuarios: son
 * usuarios normales con un rol de alcance MINISTERIO y su ministerio asignado.
 */

import mysql from 'mysql2/promise'
import { asegurarRolesBase } from './roles-base.mjs'

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: process.env.DB_USUARIO_ROOT ?? 'root',
  password: process.env.DB_CONTRASENA_ROOT ?? '',
  database: process.env.DB_NOMBRE ?? 'gosen',
}

/** Nombre del primer ministerio que se siembra (solo si la tabla está vacía). */
const MINISTERIO_INICIAL = {
  nombre: 'Cámaras',
  descripcion:
    'Equipo de cámaras: se encarga de grabar y transmitir los servicios y eventos.',
}

function log(...args) {
  console.log('[db:migrar-ministerio]', ...args)
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

async function columnasDe(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [CONFIG.database, tabla],
  )
  return new Set(filas.map((fila) => fila.COLUMN_NAME))
}

async function clavesAjenasDe(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [CONFIG.database, tabla],
  )
  return new Set(filas.map((fila) => fila.CONSTRAINT_NAME))
}

async function tipoDeColumna(conexion, tabla, columna) {
  const [filas] = await conexion.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [CONFIG.database, tabla, columna],
  )
  return filas.length > 0 ? String(filas[0].COLUMN_TYPE) : null
}

/** Añade una clave ajena si no existe (con el nombre dado). */
async function agregarClaveAjena(conexion, tabla, nombre, definicion) {
  const existentes = await clavesAjenasDe(conexion, tabla)
  if (existentes.has(nombre)) return false
  await conexion.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${nombre}\` ${definicion}`)
  return true
}

async function migrar(conexion) {
  for (const tabla of ['usuario', 'rol']) {
    if (!(await existeTabla(conexion, tabla))) {
      log(`⚠️  no existe la tabla \`${tabla}\`: ¿es la base correcta?`)
      return
    }
  }

  /* ── 1) Las tablas del módulo (mismas que esquema.sql) ────── */
  await conexion.query(`
    CREATE TABLE IF NOT EXISTS ministerio (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nombre      VARCHAR(120) NOT NULL,
      descripcion VARCHAR(500) NULL,
      encargado_id INT UNSIGNED NULL,
      activo      TINYINT(1)   NOT NULL DEFAULT 1,
      creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ministerio_nombre (nombre),
      KEY idx_ministerio_encargado (encargado_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS equipo (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      ministerio_id INT UNSIGNED NOT NULL,
      nombre        VARCHAR(120) NOT NULL,
      descripcion   VARCHAR(500) NULL,
      estatus       ENUM('DISPONIBLE','PRESTADO','MANTENIMIENTO','BAJA') NOT NULL DEFAULT 'DISPONIBLE',
      creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME    NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_equipo_ministerio_nombre (ministerio_id, nombre),
      KEY idx_equipo_ministerio (ministerio_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS prestamo (
      id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
      equipo_id         INT UNSIGNED NOT NULL,
      responsable_id    INT UNSIGNED NOT NULL,
      asignado_a_id     INT UNSIGNED NULL,
      evento_id         INT UNSIGNED NULL,
      prestado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      devuelto_en       DATETIME     NULL,
      estado_entrega    ENUM('BUENO','CON_DETALLE','DANADO') NOT NULL DEFAULT 'BUENO',
      estado_devolucion ENUM('BUENO','CON_DETALLE','DANADO') NULL,
      notas             VARCHAR(500) NULL,
      registrado_por_id INT UNSIGNED NULL,
      devuelto_por_id   INT UNSIGNED NULL,
      PRIMARY KEY (id),
      KEY idx_prestamo_equipo (equipo_id),
      KEY idx_prestamo_responsable (responsable_id),
      KEY idx_prestamo_asignado (asignado_a_id),
      KEY idx_prestamo_abiertos (devuelto_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS evento (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      ministerio_id INT UNSIGNED NOT NULL,
      nombre        VARCHAR(120) NOT NULL,
      descripcion   VARCHAR(500) NULL,
      fecha         DATE         NOT NULL,
      hora_llegada  TIME         NULL,
      latitud       DECIMAL(10,7) NULL,
      longitud      DECIMAL(10,7) NULL,
      direccion     VARCHAR(300)  NULL,
      creado_por_id INT UNSIGNED NULL,
      activo        TINYINT(1)   NOT NULL DEFAULT 1,
      creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_evento_ministerio (ministerio_id),
      KEY idx_evento_fecha (fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await conexion.query(`
    CREATE TABLE IF NOT EXISTS servidor_evento (
      id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
      evento_id         INT UNSIGNED NOT NULL,
      usuario_id        INT UNSIGNED NOT NULL,
      funcion           VARCHAR(80)  NULL,
      confirmado        TINYINT(1)   NOT NULL DEFAULT 0,
      confirmado_en     DATETIME     NULL,
      llego_en          DATETIME     NULL,
      latitud           DECIMAL(10,7) NULL,
      longitud          DECIMAL(10,7) NULL,
      direccion         VARCHAR(300)  NULL,
      registrado_por_id INT UNSIGNED NULL,
      creado_en         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_servidor_evento_usuario (evento_id, usuario_id),
      KEY idx_servidor_evento_usuario (usuario_id),
      KEY idx_servidor_evento_evento (evento_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  log('tablas ministerio, equipo, prestamo, evento y servidor_evento listas')

  // Bases creadas antes de los roles por evento: se añade la función del turno
  const columnasTurno = await columnasDe(conexion, 'servidor_evento')
  if (!columnasTurno.has('funcion')) {
    await conexion.query(
      `ALTER TABLE servidor_evento ADD COLUMN funcion VARCHAR(80) NULL AFTER usuario_id`,
    )
    log('servidor_evento.funcion añadida')
  }

  // Bases anteriores a ligar préstamos con eventos
  const columnasPrestamo = await columnasDe(conexion, 'prestamo')
  if (!columnasPrestamo.has('evento_id')) {
    await conexion.query(
      `ALTER TABLE prestamo ADD COLUMN evento_id INT UNSIGNED NULL AFTER asignado_a_id,
         ADD KEY idx_prestamo_evento (evento_id)`,
    )
    log('prestamo.evento_id añadida')
  }

  // Bases anteriores a la confirmación de recogida y de devolución por quien lleva el equipo
  if (!columnasPrestamo.has('recogido_en')) {
    await conexion.query(
      `ALTER TABLE prestamo
         ADD COLUMN recogido_en DATETIME NULL AFTER prestado_en,
         ADD COLUMN devolucion_avisada_en DATETIME NULL AFTER recogido_en,
         ADD COLUMN estado_devolucion_avisado ENUM('BUENO','CON_DETALLE','DANADO') NULL AFTER devolucion_avisada_en`,
    )
    // Lo que ya estaba prestado se da por recogido: así no aparece «por recoger» de pronto
    await conexion.query(`UPDATE prestamo SET recogido_en = prestado_en WHERE recogido_en IS NULL`)
    log('prestamo.recogido_en y devolución avisada añadidas')
  }

  /* ── 2) La cuenta sabe a qué ministerio pertenece ─────────── */
  const columnasUsuario = await columnasDe(conexion, 'usuario')
  if (!columnasUsuario.has('ministerio_id')) {
    await conexion.query(
      `ALTER TABLE usuario
         ADD COLUMN ministerio_id INT UNSIGNED NULL AFTER celula_id,
         ADD KEY idx_usuario_ministerio (ministerio_id)`,
    )
    log('usuario.ministerio_id añadido')
  } else {
    log('usuario.ministerio_id ya existía')
  }

  /* ── 3) El alcance nuevo ──────────────────────────────────── */
  const tipoAlcance = await tipoDeColumna(conexion, 'rol', 'alcance')
  if (tipoAlcance && !tipoAlcance.includes(`'MINISTERIO'`)) {
    await conexion.query(
      `ALTER TABLE rol MODIFY alcance ENUM('ORGANIZACION','RAMA','CELULA','MINISTERIO') NOT NULL`,
    )
    log('rol.alcance admite MINISTERIO')
  } else {
    log('rol.alcance ya admite MINISTERIO')
  }

  /* ── 4) Claves ajenas que falten ──────────────────────────── */
  const añadidas = []
  if (
    await agregarClaveAjena(
      conexion,
      'usuario',
      'fk_usuario_ministerio',
      'FOREIGN KEY (ministerio_id) REFERENCES ministerio (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('usuario → ministerio')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'ministerio',
      'fk_ministerio_encargado',
      'FOREIGN KEY (encargado_id) REFERENCES usuario (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('ministerio → usuario')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'equipo',
      'fk_equipo_ministerio',
      'FOREIGN KEY (ministerio_id) REFERENCES ministerio (id) ON DELETE CASCADE ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('equipo → ministerio')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'prestamo',
      'fk_prestamo_equipo',
      'FOREIGN KEY (equipo_id) REFERENCES equipo (id) ON DELETE CASCADE ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('prestamo → equipo')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'prestamo',
      'fk_prestamo_responsable',
      'FOREIGN KEY (responsable_id) REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('prestamo → responsable')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'prestamo',
      'fk_prestamo_asignado',
      'FOREIGN KEY (asignado_a_id) REFERENCES usuario (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('prestamo → asignado')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'prestamo',
      'fk_prestamo_registrado',
      'FOREIGN KEY (registrado_por_id) REFERENCES usuario (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('prestamo → registrado por')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'prestamo',
      'fk_prestamo_devuelto',
      'FOREIGN KEY (devuelto_por_id) REFERENCES usuario (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('prestamo → devuelto por')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'evento',
      'fk_evento_ministerio',
      'FOREIGN KEY (ministerio_id) REFERENCES ministerio (id) ON DELETE CASCADE ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('evento → ministerio')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'evento',
      'fk_evento_creador',
      'FOREIGN KEY (creado_por_id) REFERENCES usuario (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('evento → creador')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'prestamo',
      'fk_prestamo_evento',
      'FOREIGN KEY (evento_id) REFERENCES evento (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('prestamo → evento')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'servidor_evento',
      'fk_servidor_evento_evento',
      'FOREIGN KEY (evento_id) REFERENCES evento (id) ON DELETE CASCADE ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('servidor_evento → evento')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'servidor_evento',
      'fk_servidor_evento_usuario',
      'FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('servidor_evento → usuario')
  }
  if (
    await agregarClaveAjena(
      conexion,
      'servidor_evento',
      'fk_servidor_evento_registro',
      'FOREIGN KEY (registrado_por_id) REFERENCES usuario (id) ON DELETE SET NULL ON UPDATE CASCADE',
    )
  ) {
    añadidas.push('servidor_evento → registrado por')
  }
  log(añadidas.length > 0 ? `claves ajenas añadidas: ${añadidas.join(', ')}` : 'claves ajenas ya estaban')

  /* ── 5) Los roles base nuevos ─────────────────────────────── */
  const roles = await asegurarRolesBase(conexion)
  log('roles base:', [...roles.keys()].join(', '))

  /* ── 6) El primer ministerio (solo si no hay ninguno) ─────── */
  const [cuantos] = await conexion.query('SELECT COUNT(*) AS n FROM ministerio')
  if (Number(cuantos[0].n) === 0) {
    const [resultado] = await conexion.query(
      'INSERT INTO ministerio (nombre, descripcion) VALUES (?, ?)',
      [MINISTERIO_INICIAL.nombre, MINISTERIO_INICIAL.descripcion],
    )
    log(`ministerio «${MINISTERIO_INICIAL.nombre}» creado (id ${resultado.insertId})`)
  } else {
    log(`ya hay ${cuantos[0].n} ministerio(s): no se siembra ninguno.`)
  }

  log('')
  log('Siguiente paso: en /panel/usuarios crea las cuentas del ministerio con un rol')
  log('de alcance «Un ministerio» (Encargado de ministerio / Servidor de ministerio).')
}

main().catch((error) => {
  console.error('[db:migrar-ministerio] error:', error.message)
  process.exitCode = 1
})
