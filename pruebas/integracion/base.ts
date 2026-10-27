/**
 * Ayudante de las pruebas de integración: base de datos de PRUEBA (`gosen_test`).
 *
 * Las pruebas usan la capa de datos real (`src/lib/db/*`) contra MySQL. Si MySQL no
 * está encendido o la base no está preparada, `baseLista` es false y las pruebas se
 * saltan (`describe.skipIf`) en vez de fallar: `npm test` sigue sirviendo sin base.
 *
 * Para prepararla:  npm run db:preparar-pruebas
 */

import mysql from 'mysql2/promise'
import { ejecutar, consultarUno } from '@/lib/db/conexion'
import type { Usuario } from '@/types/domain'

const NOMBRE = process.env.DB_NOMBRE ?? ''

/** Nunca se corre contra la base de desarrollo ni contra una remota. */
if (!/test/i.test(NOMBRE)) {
  throw new Error(
    `Las pruebas de integración exigen una base «test» (DB_NOMBRE=${NOMBRE || '(vacío)'}). ` +
      'Revisa vitest.config.ts.',
  )
}

async function comprobarBase(): Promise<boolean> {
  try {
    const conexion = await mysql.createConnection({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PUERTO ?? 3306),
      user: process.env.DB_USUARIO ?? 'gosen',
      password: process.env.DB_CONTRASENA ?? 'gosen_dev',
      database: NOMBRE,
      connectTimeout: 2000,
    })
    const [filas] = await conexion.query(`SHOW TABLES LIKE 'prestamo'`)
    await conexion.end()
    return Array.isArray(filas) && filas.length > 0
  } catch {
    return false
  }
}

/** true si hay MySQL con el esquema listo. */
export const baseLista = await comprobarBase()

/** Sufijo único por ejecución: las pruebas crean sus propios datos y no chocan con otros. */
export const SUFIJO = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** id de un rol base por su nombre (los crea `db:preparar-pruebas`). */
export async function rolId(nombre: string): Promise<number> {
  const fila = await consultarUno<{ id: number }>(`SELECT id FROM rol WHERE nombre = ?`, [nombre])
  if (!fila) throw new Error(`Falta el rol «${nombre}». Ejecuta: npm run db:preparar-pruebas`)
  return fila.id
}

export async function crearMinisterioDePrueba(etiqueta: string): Promise<number> {
  const { insertId } = await ejecutar(`INSERT INTO ministerio (nombre, descripcion) VALUES (?, NULL)`, [
    `Prueba ${etiqueta} ${SUFIJO}`,
  ])
  return insertId
}

export async function crearCuentaDePrueba(datos: {
  etiqueta: string
  rol: string
  ministerioId?: number | null
  activo?: boolean
}): Promise<number> {
  const { insertId } = await ejecutar(
    `INSERT INTO usuario (email, nombre, contrasena_hash, rol_id, ministerio_id, activo)
     VALUES (?, ?, 'no-se-usa', ?, ?, ?)`,
    [
      `${datos.etiqueta}-${SUFIJO}@prueba.test`,
      `Cuenta ${datos.etiqueta}`,
      await rolId(datos.rol),
      datos.ministerioId ?? null,
      datos.activo === false ? 0 : 1,
    ],
  )
  return insertId
}

export async function crearEquipoDePrueba(ministerioId: number, nombre: string): Promise<number> {
  const { insertId } = await ejecutar(
    `INSERT INTO equipo (ministerio_id, nombre, descripcion) VALUES (?, ?, NULL)`,
    [ministerioId, `${nombre} ${SUFIJO}`],
  )
  return insertId
}

/** Identidades mínimas para las consultas con alcance de ministerio. */
export const comoOrganizacion: Pick<Usuario, 'alcance' | 'ministerioId'> = {
  alcance: 'ORGANIZACION',
  ministerioId: null,
}
export const comoMinisterio = (ministerioId: number): Pick<Usuario, 'alcance' | 'ministerioId'> => ({
  alcance: 'MINISTERIO',
  ministerioId,
})
export const comoRama = (): Pick<Usuario, 'alcance' | 'ministerioId'> => ({
  alcance: 'RAMA',
  ministerioId: null,
})
