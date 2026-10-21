import mysql from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2'

/**
 * Acceso a datos de MySQL.
 * Todas las consultas del proyecto pasan por aquí; ningún componente escribe SQL.
 */

const configuracion = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  user: process.env.DB_USUARIO ?? 'gosen',
  password: process.env.DB_CONTRASENA ?? 'gosen_dev',
  database: process.env.DB_NOMBRE ?? 'gosen',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
} satisfies mysql.PoolOptions

declare global {
  var __poolGosen: mysql.Pool | undefined
}

/** Pool único: sobrevive al recargado en caliente del servidor de desarrollo. */
export function obtenerPool(): mysql.Pool {
  if (!globalThis.__poolGosen) {
    globalThis.__poolGosen = mysql.createPool(configuracion)
  }
  return globalThis.__poolGosen
}

/**
 * Traduce los errores de mysql2 a un mensaje accionable.
 * Sin esto, una base caída se ve como un stack ilegible dentro de `consultar`.
 */
function explicarError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(String(error))
  const codigo = (error as { code?: string }).code

  const mysql = [process.env.LOCALAPPDATA, 'Programs', 'mysql'].filter(Boolean).join('\\')
  const arranque =
    `mysqld.exe --no-defaults --basedir="${mysql}" ` +
    `--datadir="${mysql}\\data" --port=3306 --bind-address=127.0.0.1`

  const mensajes: Record<string, string> = {
    ECONNREFUSED: `MySQL no está escuchando en ${configuracion.host}:${configuracion.port}. Arráncalo con ${arranque} (ver MEMORY.md §11)`,
    ENOTFOUND: `No se resuelve el host ${configuracion.host}. Revisa DB_HOST en .env.local`,
    ETIMOUT: `Se agotó el tiempo de espera con MySQL en ${configuracion.host}:${configuracion.port}`,
    ER_ACCESS_DENIED_ERROR: `Credenciales incorrectas para el usuario "${configuracion.user}". Revisa DB_USUARIO/DB_CONTRASENA en .env.local`,
    ER_BAD_DB_ERROR: `No existe la base de datos "${configuracion.database}". Ejecuta: npm run db:setup`,
    ER_NO_SUCH_TABLE: `Falta el esquema. Ejecuta: npm run db:setup`,
  }

  const detalle = codigo ? mensajes[codigo] : undefined
  if (!detalle) return error

  const traducido = new Error(`${detalle}\n(origen: ${error.message})`)
  traducido.cause = error
  return traducido
}

/**
 * Ejecuta una consulta SELECT y devuelve las filas.
 * mysql2 no conoce las formas de negocio, por eso la conversión ocurre aquí,
 * una sola vez, en el límite de la base de datos.
 */
export async function consultar<T>(sql: string, parametros: unknown[] = []): Promise<T[]> {
  try {
    const [filas] = await obtenerPool().query<RowDataPacket[]>(sql, parametros)
    return filas as unknown as T[]
  } catch (error) {
    throw explicarError(error)
  }
}

/** Igual que `consultar` pero devuelve la primera fila o null. */
export async function consultarUno<T>(sql: string, parametros: unknown[] = []): Promise<T | null> {
  const filas = await consultar<T>(sql, parametros)
  return filas.length > 0 ? (filas[0] as T) : null
}

/** Ejecuta INSERT/UPDATE/DELETE. Devuelve el id insertado y las filas afectadas. */
export async function ejecutar(
  sql: string,
  parametros: unknown[] = [],
): Promise<{ insertId: number; affectedRows: number }> {
  // Límite de confianza con mysql2: sus tipos no aceptan `unknown[]`.
  const valores = parametros as never[]
  try {
    const resultado = await obtenerPool().execute(sql, valores)
    const info = resultado[0] as mysql.ResultSetHeader
    return { insertId: info.insertId, affectedRows: info.affectedRows }
  } catch (error) {
    throw explicarError(error)
  }
}

/** Conexión con transacción abierta, entregada a `transaccion`. */
export interface Transaccion {
  ejecutar(
    sql: string,
    parametros?: unknown[],
  ): Promise<{ insertId: number; affectedRows: number }>
}

/**
 * Agrupa varias escrituras en una sola transacción: o se guardan todas o
 * ninguna (p. ej. crear un rol y todos sus permisos).
 */
export async function transaccion<T>(trabajo: (tx: Transaccion) => Promise<T>): Promise<T> {
  const conexion = await obtenerPool().getConnection()
  try {
    await conexion.beginTransaction()
    const tx: Transaccion = {
      async ejecutar(sql, parametros = []) {
        const resultado = await conexion.execute(sql, parametros as never[])
        const info = resultado[0] as mysql.ResultSetHeader
        return { insertId: info.insertId, affectedRows: info.affectedRows }
      },
    }
    const resultado = await trabajo(tx)
    await conexion.commit()
    return resultado
  } catch (error) {
    await conexion.rollback().catch(() => undefined)
    throw explicarError(error)
  } finally {
    conexion.release()
  }
}
