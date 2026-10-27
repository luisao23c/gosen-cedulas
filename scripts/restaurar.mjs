#!/usr/bin/env node
/**
 * Restaura un respaldo hecho con `npm run db:respaldar`.
 *
 *   npm run db:restaurar -- respaldos/gosen-2026-10-26-18-00-00.sql --confirmar
 *
 * ⚠️  REEMPLAZA las tablas de la base indicada por las del archivo: lo que haya ahora se pierde.
 * Por eso exige `--confirmar` y antes de empezar dice a qué base va a escribir.
 * Solo acepta archivos que traigan la marca de los respaldos de Gosén (no ejecuta SQL ajeno).
 *
 * Usa la cuenta de la aplicación (DB_USUARIO / DB_CONTRASENA): necesita poder borrar y crear
 * tablas. En el MySQL local la crea `npm run db:setup`; en una base gestionada es la del proveedor.
 */

import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: process.env.DB_USUARIO ?? 'gosen',
  password: process.env.DB_CONTRASENA ?? 'gosen_dev',
  database: process.env.DB_NOMBRE ?? 'gosen',
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  multipleStatements: true,
}

const MARCA = '-- Respaldo de Gosén'
const LIMITE_BYTES = 16 * 1024 * 1024

function log(...args) {
  console.log('[db:restaurar]', ...args)
}

async function main() {
  const [ruta] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  if (!ruta) throw new Error('Indica el archivo: npm run db:restaurar -- respaldos/archivo.sql --confirmar')

  const sql = await readFile(ruta, 'utf8')
  if (!sql.startsWith(MARCA)) throw new Error('El archivo no parece un respaldo de Gosén (falta la marca inicial).')
  if (Buffer.byteLength(sql) > LIMITE_BYTES) {
    throw new Error(`El respaldo pesa más de ${LIMITE_BYTES / 1024 / 1024} MB: cárgalo con el cliente de MySQL (mysql < archivo.sql).`)
  }

  log(`destino: ${CONFIG.host}:${CONFIG.port} / base «${CONFIG.database}»`)
  if (!process.argv.includes('--confirmar')) {
    throw new Error('Esto REEMPLAZA los datos de esa base. Si es lo que quieres, repite el comando con --confirmar.')
  }

  const conexion = await mysql.createConnection(CONFIG)
  try {
    await conexion.query(sql)
    const [tablas] = await conexion.query(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`)
    log(`restauradas ${tablas.length} tablas desde ${ruta}`)
  } finally {
    await conexion.end().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('[db:restaurar] error:', error.message)
  process.exitCode = 1
})
