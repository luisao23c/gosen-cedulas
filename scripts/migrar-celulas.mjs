#!/usr/bin/env node
/**
 * Renombra el dominio «cédula» a «célula» en una base EXISTENTE, sin tocar los
 * datos:
 *
 *   · tabla `cedula`            → `celula`
 *   · columnas `cedula_id`      → `celula_id` (integrante, reunion, usuario)
 *   · índices y claves ajenas con «cedula» en el nombre
 *   · el valor `CEDULA` del enum `rol.alcance` → `CELULA`
 *   · los permisos guardados `cedula:*` → `celula:*` (tabla rol_permiso)
 *
 *   npm run db:migrar-celulas
 *
 * Es idempotente: si ya está renombrado, no hace nada.
 *
 * ⚠️  En bases anteriores a este renombrado, ejecuta ESTE script ANTES de
 *     `db:migrar-roles`, `db:migrar-integrantes`, `db:migrar-ubicaciones` y
 *     `db:migrar-asistencia`: esos ya escriben los nombres nuevos.
 *
 * Usa el usuario ROOT (como las demás migraciones): el usuario de la
 * aplicación tiene DML, pero no DDL. Haz copia antes si la base es real:
 *   mysqldump gosen > copia.sql
 */

import mysql from 'mysql2/promise'

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: process.env.DB_USUARIO_ROOT ?? 'root',
  password: process.env.DB_CONTRASENA_ROOT ?? '',
  database: process.env.DB_NOMBRE ?? 'gosen',
}

/** Columnas que cambian de nombre (la tabla es la que las contiene). */
const COLUMNAS = [
  ['integrante', 'cedula_id', 'celula_id'],
  ['reunion', 'cedula_id', 'celula_id'],
  ['usuario', 'cedula_id', 'celula_id'],
]

/**
 * Claves ajenas que hay que rehacer con el nombre nuevo (MySQL no las
 * renombra). La definición es la misma de `esquema.sql`.
 */
const CLAVES_AJENAS = [
  ['integrante', 'fk_integrante_cedula', 'fk_integrante_celula',
    'FOREIGN KEY (celula_id) REFERENCES celula (id) ON DELETE CASCADE ON UPDATE CASCADE'],
  ['reunion', 'fk_reunion_cedula', 'fk_reunion_celula',
    'FOREIGN KEY (celula_id) REFERENCES celula (id) ON DELETE CASCADE ON UPDATE CASCADE'],
  ['usuario', 'fk_usuario_cedula', 'fk_usuario_celula',
    'FOREIGN KEY (celula_id) REFERENCES celula (id) ON DELETE SET NULL ON UPDATE CASCADE'],
  ['celula', 'fk_cedula_rama', 'fk_celula_rama',
    'FOREIGN KEY (rama_id) REFERENCES rama (id) ON DELETE CASCADE ON UPDATE CASCADE'],
  ['celula', 'fk_cedula_lider', 'fk_celula_lider',
    'FOREIGN KEY (lider_id) REFERENCES usuario (id) ON DELETE SET NULL ON UPDATE CASCADE'],
]

function log(...args) {
  console.log('[db:migrar-celulas]', ...args)
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

async function columnasDe(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [CONFIG.database, tabla],
  )
  return new Set(filas.map((fila) => fila.COLUMN_NAME))
}

async function indicesDe(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [CONFIG.database, tabla],
  )
  return filas.map((fila) => fila.INDEX_NAME)
}

async function clavesAjenasDe(conexion, tabla) {
  const [filas] = await conexion.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [CONFIG.database, tabla],
  )
  return filas.map((fila) => fila.CONSTRAINT_NAME)
}

async function tipoDeColumna(conexion, tabla, columna) {
  const [filas] = await conexion.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [CONFIG.database, tabla, columna],
  )
  return filas.length > 0 ? String(filas[0].COLUMN_TYPE) : null
}

/** Definición completa de una columna («int(10) unsigned NOT NULL»), para `CHANGE COLUMN`. */
async function definicionDeColumna(conexion, tabla, columna) {
  const [filas] = await conexion.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [CONFIG.database, tabla, columna],
  )
  if (filas.length === 0) return null
  const fila = filas[0]
  let definicion = String(fila.COLUMN_TYPE)
  definicion += fila.IS_NULLABLE === 'YES' ? ' NULL' : ' NOT NULL'
  if (fila.COLUMN_DEFAULT !== null && fila.COLUMN_DEFAULT !== undefined) {
    const porDefecto = fila.COLUMN_DEFAULT
    const numerico = /^(int|bigint|smallint|tinyint|decimal|float|double)/i.test(definicion)
    definicion += ` DEFAULT ${numerico ? porDefecto : `'${String(porDefecto).replace(/'/g, "''")}'`}`
  }
  if (fila.EXTRA) definicion += ` ${fila.EXTRA}`
  return definicion
}

/**
 * Renombra una columna.
 *
 * `RENAME COLUMN` llegó con MySQL 8.0 y MariaDB 10.5; en instalaciones más
 * viejas (MariaDB 10.4) hay que usar `CHANGE COLUMN` repitiendo la definición
 * actual. Se intenta lo moderno y, si el servidor no lo entiende, se cae al
 * camino compatible: así el mismo script sirve en las dos bases.
 */
async function renombrarColumna(conexion, tabla, vieja, nueva) {
  try {
    await conexion.query(`ALTER TABLE \`${tabla}\` RENAME COLUMN \`${vieja}\` TO \`${nueva}\``)
    return true
  } catch {
    const definicion = await definicionDeColumna(conexion, tabla, vieja)
    if (!definicion) return false
    await conexion.query(
      `ALTER TABLE \`${tabla}\` CHANGE COLUMN \`${vieja}\` \`${nueva}\` ${definicion}`,
    )
    return true
  }
}

/** Columnas de un índice, en orden (para recrearlo por el camino compatible). */
async function columnasDeIndice(conexion, tabla, indice) {
  const [filas] = await conexion.query(
    `SELECT COLUMN_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
      ORDER BY SEQ_IN_INDEX`,
    [CONFIG.database, tabla, indice],
  )
  return filas.map((fila) => fila.COLUMN_NAME)
}

/**
 * Renombra un índice. Igual que las columnas: `RENAME INDEX` no existe en
 * MariaDB 10.4, así que se crea el nuevo y se suelta el viejo en la MISMA
 * sentencia (atómica) para no dejar a una clave ajena sin índice un instante.
 */
async function renombrarIndice(conexion, tabla, viejo, nuevo) {
  try {
    await conexion.query(`ALTER TABLE \`${tabla}\` RENAME INDEX \`${viejo}\` TO \`${nuevo}\``)
    return
  } catch {
    const columnas = await columnasDeIndice(conexion, tabla, viejo)
    if (columnas.length === 0) return
    await conexion.query(
      `ALTER TABLE \`${tabla}\` ADD INDEX \`${nuevo}\` (${columnas
        .map((columna) => `\`${columna}\``)
        .join(', ')}), DROP INDEX \`${viejo}\``,
    )
  }
}

/**
 * Renombra los roles que llevan «cédula» en el nombre o la descripción.
 *
 * Los roles los creó el administrador y viven en la base: si no se renombran,
 * al volver a crear los roles base aparecería un duplicado («Líder de cédula»
 * junto a «Líder de célula») con las cuentas partidas entre los dos. Si el
 * nombre nuevo ya existe, se fusionan: se pasan las cuentas y los permisos
 * antes de borrar el viejo.
 */
async function renombrarRoles(conexion) {
  const [roles] = await conexion.query('SELECT id, nombre, descripcion, es_sistema FROM rol')
  const porNombre = new Map(roles.map((rol) => [rol.nombre, rol]))

  for (const rol of roles) {
    if (!/c[eé]dula/i.test(rol.nombre) && !(rol.descripcion && /c[eé]dula/i.test(rol.descripcion))) {
      continue
    }
    const cambiar = (texto) => texto.split('cédula').join('célula').split('Cédula').join('Célula')
    const nombreNuevo = cambiar(rol.nombre)
    const descripcionNueva = rol.descripcion ? cambiar(rol.descripcion) : null
    const gemelo = porNombre.get(nombreNuevo)

    if (gemelo && gemelo.id !== rol.id) {
      // El nombre nuevo ya está tomado: se fusiona el viejo con el nuevo.
      const [cuentas] = await conexion.query('UPDATE usuario SET rol_id = ? WHERE rol_id = ?', [
        gemelo.id,
        rol.id,
      ])
      const [permisos] = await conexion.query(
        `INSERT IGNORE INTO rol_permiso (rol_id, recurso, accion)
          SELECT ?, recurso, accion FROM rol_permiso WHERE rol_id = ?`,
        [gemelo.id, rol.id],
      )
      await conexion.query('DELETE FROM rol WHERE id = ?', [rol.id])
      log(
        `rol «${rol.nombre}» fusionado con «${nombreNuevo}»: ${cuentas.affectedRows} cuenta(s) movida(s), ` +
          `${permisos.affectedRows} permiso(s) copiado(s).`,
      )
      continue
    }

    await conexion.query('UPDATE rol SET nombre = ?, descripcion = ? WHERE id = ?', [
      nombreNuevo,
      descripcionNueva,
      rol.id,
    ])
    log(`rol «${rol.nombre}» → «${nombreNuevo}»`)
  }
}

async function migrar(conexion) {
  const hayVieja = await existeTabla(conexion, 'cedula')
  const hayNueva = await existeTabla(conexion, 'celula')

  /* ── 1) La tabla ──────────────────────────────────────────── */
  if (hayVieja && !hayNueva) {
    await conexion.query('RENAME TABLE `cedula` TO `celula`')
    log('tabla `cedula` → `celula`')
  } else if (hayVieja && hayNueva) {
    log('⚠️  existen `cedula` y `celula` a la vez: revisa la base a mano; no toco nada.')
  } else if (hayNueva) {
    log('la tabla ya se llama `celula`.')
  } else {
    log('⚠️  no existe ni `cedula` ni `celula`: ¿es la base correcta?')
    return
  }

  /* ── 2) Columnas ──────────────────────────────────────────── */
  for (const [tabla, vieja, nueva] of COLUMNAS) {
    if (!(await existeTabla(conexion, tabla))) continue
    const columnas = await columnasDe(conexion, tabla)
    if (columnas.has(vieja) && !columnas.has(nueva)) {
      await renombrarColumna(conexion, tabla, vieja, nueva)
      log(`${tabla}.${vieja} → ${nueva}`)
    } else if (columnas.has(nueva)) {
      log(`${tabla}.${nueva} ya tenía el nombre nuevo.`)
    }
  }

  /* ── 3) Claves ajenas (hay que rehacerlas) ────────────────── */
  for (const [tabla, vieja, nueva, definicion] of CLAVES_AJENAS) {
    if (!(await existeTabla(conexion, tabla))) continue
    const claves = await clavesAjenasDe(conexion, tabla)
    if (claves.includes(vieja)) {
      await conexion.query(`ALTER TABLE \`${tabla}\` DROP FOREIGN KEY \`${vieja}\``)
      await conexion.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${nueva}\` ${definicion}`)
      log(`${tabla}: clave ajena ${vieja} → ${nueva}`)
    }
  }

  /* ── 4) Índices ───────────────────────────────────────────── */
  for (const tabla of ['celula', 'integrante', 'reunion', 'usuario']) {
    if (!(await existeTabla(conexion, tabla))) continue
    for (const indice of await indicesDe(conexion, tabla)) {
      if (!indice.includes('cedula')) continue
      const nuevo = indice.split('cedula').join('celula')
      await renombrarIndice(conexion, tabla, indice, nuevo)
      log(`${tabla}: índice ${indice} → ${nuevo}`)
    }
  }

  /* ── 5) El alcance `CEDULA` pasa a `CELULA` ───────────────── */
  if (await existeTabla(conexion, 'rol')) {
    const tipo = await tipoDeColumna(conexion, 'rol', 'alcance')
    if (tipo && tipo.includes(`'CEDULA'`)) {
      // Se abre el enum a los dos valores, se traducen las filas y se cierra:
      // modificar el enum de golpe convertiría `CEDULA` en cadena vacía.
      await conexion.query(
        `ALTER TABLE rol MODIFY alcance ENUM('ORGANIZACION','RAMA','CEDULA','CELULA','MINISTERIO') NOT NULL`,
      )
      const [resultado] = await conexion.query(
        `UPDATE rol SET alcance = 'CELULA' WHERE alcance = 'CEDULA'`,
      )
      await conexion.query(
        `ALTER TABLE rol MODIFY alcance ENUM('ORGANIZACION','RAMA','CELULA','MINISTERIO') NOT NULL`,
      )
      log(`rol.alcance: CEDULA → CELULA (${resultado.affectedRows} rol(es))`)
    } else {
      log('rol.alcance ya habla de CELULA.')
    }
  }

  /* ── 6) Los roles, que también son datos ──────────────────── */
  await renombrarRoles(conexion)

  /* ── 7) Los permisos guardados ────────────────────────────── */
  if (await existeTabla(conexion, 'rol_permiso')) {
    const [resultado] = await conexion.query(
      `UPDATE rol_permiso SET recurso = 'celula' WHERE recurso = 'cedula'`,
    )
    log(`rol_permiso: ${resultado.affectedRows} permiso(s) cedula:* → celula:*`)
  }

  log('')
  log('Listo. Los permisos del catálogo (`celula:ver`, `celula:crear`…) son los mismos que antes.')
}

main().catch((error) => {
  console.error('[db:migrar-celulas] error:', error.message)
  process.exitCode = 1
})
