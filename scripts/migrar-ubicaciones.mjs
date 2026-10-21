#!/usr/bin/env node
/**
 * Migra una base YA EN USO al modelo de ubicación por mapa:
 *
 *   · añade `celula.latitud`, `celula.longitud` y `celula.direccion`
 *   · añade `integrante.latitud`, `integrante.longitud` y `integrante.direccion`
 *   · convierte el domicilio escrito en la dirección de esa ubicación y luego
 *     LO BORRA (calle, número, colonia, ciudad, estado, CP), junto con el
 *     correo del integrante, que dejó de usarse (MEMORY §7).
 *
 *   npm run db:migrar-ubicaciones
 *
 * Es idempotente: se puede ejecutar las veces que haga falta.
 *
 * Usa el usuario ROOT (como `db:migrar-roles`): el usuario de la aplicación
 * tiene SELECT/INSERT/UPDATE/DELETE, pero no DDL. Si MySQL responde
 * «ALTER command denied…», revisa DB_USUARIO_ROOT y DB_CONTRASENA_ROOT.
 *
 * ⚠️  El borrado del domicilio es irreversible: si la base tiene datos reales,
 *     haz copia antes (`mysqldump gosen > copia.sql`).
 */

import mysql from 'mysql2/promise'

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: process.env.DB_USUARIO_ROOT ?? 'root',
  password: process.env.DB_CONTRASENA_ROOT ?? '',
  database: process.env.DB_NOMBRE ?? 'gosen',
}

/** Columnas del domicilio escrito que se sustituyen por el punto del mapa. */
const COLUMNAS_DOMICILIO = ['calle', 'numero', 'colonia', 'ciudad', 'estado', 'cp']

function log(...args) {
  console.log('[db:migrar-ubicaciones]', ...args)
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

async function agregarSiFalta(conexion, tabla, columna, definicion) {
  const existentes = await columnasDe(conexion, tabla)
  if (existentes.has(columna)) return false
  await conexion.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definicion}`)
  return true
}

async function migrar(conexion) {
  /* ── 1) Célula: dónde se reúne (punto del mapa) ───────────── */
  if (!(await existeTabla(conexion, 'celula'))) {
    log('no existe la tabla `celula`: nada que migrar aquí.')
  } else {
    const añadidas = []
    if (await agregarSiFalta(conexion, 'celula', 'latitud', 'DECIMAL(10,7) NULL')) {
      añadidas.push('latitud')
    }
    if (await agregarSiFalta(conexion, 'celula', 'longitud', 'DECIMAL(10,7) NULL')) {
      añadidas.push('longitud')
    }
    if (await agregarSiFalta(conexion, 'celula', 'direccion', 'VARCHAR(300) NULL')) {
      añadidas.push('direccion')
    }
    log(
      añadidas.length > 0
        ? `celula: columnas añadidas → ${añadidas.join(', ')}`
        : 'celula: ya tenía las columnas de ubicación.',
    )

    // `lugar` («Casa de oración», «Salón comunal») dejó de pedirse: ahora lo
    // que identifica el sitio es el punto del mapa y su dirección.
    const columnasCelula = await columnasDe(conexion, 'celula')
    if (columnasCelula.has('lugar')) {
      await conexion.query('ALTER TABLE `celula` DROP COLUMN `lugar`')
      log('celula: campo «lugar» retirado.')
    }
  }

  /* ── 2) Integrante: dónde vive (sustituye al domicilio) ───── */
  if (!(await existeTabla(conexion, 'integrante'))) {
    log('no existe la tabla `integrante`: nada que migrar aquí.')
    return
  }

  const propias = await columnasDe(conexion, 'integrante')
  const añadidas = []
  if (await agregarSiFalta(conexion, 'integrante', 'latitud', 'DECIMAL(10,7) NULL')) {
    añadidas.push('latitud')
  }
  if (await agregarSiFalta(conexion, 'integrante', 'longitud', 'DECIMAL(10,7) NULL')) {
    añadidas.push('longitud')
  }
  if (await agregarSiFalta(conexion, 'integrante', 'direccion', 'VARCHAR(300) NULL')) {
    añadidas.push('direccion')
  }
  if (añadidas.length > 0) log(`integrante: columnas añadidas → ${añadidas.join(', ')}`)

  /* ── 3) El domicilio escrito pasa a ser la dirección del punto ── */
  const tieneDomicilio = COLUMNAS_DOMICILIO.some((columna) => propias.has(columna))
  if (tieneDomicilio) {
    // Se conserva la información en `direccion` antes de borrar las columnas:
    // así nadie pierde lo que había escrito cuando no hay coordenadas.
    const partes = COLUMNAS_DOMICILIO.filter((columna) => propias.has(columna))
      .map((columna) => `NULLIF(TRIM(\`${columna}\`), '')`)
      .join(', ')
    const [resultado] = await conexion.query(
      `UPDATE integrante
          SET direccion = NULLIF(TRIM(CONCAT_WS(', ', ${partes})), '')
        WHERE direccion IS NULL`,
    )
    log(`integrante: ${resultado.affectedRows} dirección(es) recuperadas del domicilio anterior.`)

    for (const columna of COLUMNAS_DOMICILIO) {
      if (!propias.has(columna)) continue
      await conexion.query(`ALTER TABLE \`integrante\` DROP COLUMN \`${columna}\``)
    }
    log(`integrante: domicilio eliminado → ${COLUMNAS_DOMICILIO.join(', ')}`)
  } else {
    log('integrante: ya no tenía columnas de domicilio.')
  }

  /* ── 4) El correo del integrante deja de existir ──────────── */
  if (propias.has('email')) {
    const [cuantos] = await conexion.query(
      `SELECT COUNT(*) AS n FROM integrante WHERE email IS NOT NULL AND email <> ''`,
    )
    await conexion.query('ALTER TABLE `integrante` DROP COLUMN `email`')
    log(
      `integrante: correo eliminado (${cuantos[0].n} registro(s) lo tenían; la cuenta de acceso sigue en ` +
        '`usuario`, que no se toca).',
    )
  } else {
    log('integrante: ya no tenía correo.')
  }

  log('')
  log('Listo. El rol «Lobby» se crea con `npm run db:migrar-roles` (o desde /panel/roles).')
}

main().catch((error) => {
  console.error('[db:migrar-ubicaciones] error:', error.message)
  process.exitCode = 1
})
