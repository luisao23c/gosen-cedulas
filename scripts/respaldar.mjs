#!/usr/bin/env node
/**
 * Respaldo de la base de datos en un solo archivo `.sql` (esquema + datos).
 *
 *   npm run db:respaldar                      → respaldos/gosen-AAAA-MM-DD-HH-MM-SS.sql
 *   npm run db:respaldar -- --salida=ruta.sql
 *
 * No necesita `mysqldump`: funciona igual con el MySQL local que con una base gestionada
 * (Aiven, TiDB…; con DB_SSL=true). Usa la cuenta de la aplicación (DB_USUARIO / DB_CONTRASENA),
 * que solo necesita poder leer.
 *
 * ⚠️  El archivo contiene datos personales (nombres, teléfonos, ubicaciones, correos y los
 * hashes de las contraseñas). Guárdalo en un lugar privado y NUNCA lo subas a Git
 * (`respaldos/` está en .gitignore).
 *
 * Para volver a cargarlo:  npm run db:restaurar -- respaldos/archivo.sql --confirmar
 */

import { mkdir, open } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import mysql from 'mysql2/promise'

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: process.env.DB_USUARIO ?? 'gosen',
  password: process.env.DB_CONTRASENA ?? 'gosen_dev',
  database: process.env.DB_NOMBRE ?? 'gosen',
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  // Fechas y decimales como TEXTO: se guardan tal cual, sin pasar por zonas horarias ni por coma flotante
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
}

const FILAS_POR_PAGINA = 500
const FILAS_POR_INSERT = 100

function argumento(nombre) {
  const encontrado = process.argv.find((arg) => arg.startsWith(`${nombre}=`))
  return encontrado ? encontrado.slice(nombre.length + 1) : undefined
}

function log(...args) {
  console.log('[db:respaldar]', ...args)
}

/** Valor listo para ir dentro de un INSERT. */
function literal(conexion, valor) {
  if (valor !== null && typeof valor === 'object' && !(valor instanceof Date) && !Buffer.isBuffer(valor)) {
    return conexion.escape(JSON.stringify(valor))
  }
  return conexion.escape(valor)
}

async function main() {
  const marca = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const ruta = argumento('--salida') ?? join('respaldos', `${CONFIG.database}-${marca}.sql`)
  await mkdir(dirname(ruta), { recursive: true })

  const conexion = await mysql.createConnection(CONFIG)
  const archivo = await open(ruta, 'w')
  try {
    const [filasTablas] = await conexion.query(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`)
    const tablas = filasTablas.map((fila) => Object.values(fila)[0])

    await archivo.write(
      `-- Respaldo de Gosén · base «${CONFIG.database}» · ${new Date().toISOString()}\n` +
        `-- Contiene datos personales: guárdalo en un lugar privado.\n\n` +
        `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET UNIQUE_CHECKS = 0;\n\n`,
    )

    const resumen = []
    for (const tabla of tablas) {
      const [[definicion]] = await conexion.query(`SHOW CREATE TABLE \`${tabla}\``)
      await archivo.write(`-- ${tabla}\nDROP TABLE IF EXISTS \`${tabla}\`;\n${definicion['Create Table']};\n\n`)

      let total = 0
      for (let desde = 0; ; desde += FILAS_POR_PAGINA) {
        const [filas] = await conexion.query(
          `SELECT * FROM \`${tabla}\` ORDER BY 1 LIMIT ? OFFSET ?`,
          [FILAS_POR_PAGINA, desde],
        )
        if (filas.length === 0) break

        const columnas = Object.keys(filas[0]).map((columna) => `\`${columna}\``).join(', ')
        for (let i = 0; i < filas.length; i += FILAS_POR_INSERT) {
          const grupo = filas.slice(i, i + FILAS_POR_INSERT)
          const valores = grupo
            .map((fila) => `(${Object.values(fila).map((valor) => literal(conexion, valor)).join(', ')})`)
            .join(',\n  ')
          await archivo.write(`INSERT INTO \`${tabla}\` (${columnas}) VALUES\n  ${valores};\n`)
        }
        total += filas.length
        if (filas.length < FILAS_POR_PAGINA) break
      }
      await archivo.write('\n')
      resumen.push([tabla, total])
    }

    await archivo.write(`SET UNIQUE_CHECKS = 1;\nSET FOREIGN_KEY_CHECKS = 1;\n`)

    const { size } = await archivo.stat()
    for (const [tabla, total] of resumen) log(`${tabla.padEnd(24)} ${String(total).padStart(7)} filas`)
    log(`listo → ${ruta} (${(size / 1024).toFixed(1)} KB)`)
    log('⚠️  Contiene datos personales: guárdalo en un lugar privado y no lo subas a Git.')
  } finally {
    await archivo.close()
    await conexion.end().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('[db:respaldar] error:', error.message)
  process.exitCode = 1
})
