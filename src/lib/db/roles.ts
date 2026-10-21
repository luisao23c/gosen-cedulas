import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar, transaccion, type Transaccion } from '@/lib/db/conexion'
import { permisosEfectivos } from '@/lib/auth/permisos'
import type { Alcance, Rol, RolConUso } from '@/types/domain'

/**
 * Acceso a datos de `rol` y `rol_permiso`.
 * Un rol es un nombre, un alcance y un conjunto de permisos «recurso:accion».
 * Los permisos que devuelve este módulo ya son los EFECTIVOS (ver
 * `permisosEfectivos`): el rol de sistema siempre trae el catálogo completo.
 */

interface FilaRol extends RowDataPacket {
  id: number
  nombre: string
  descripcion: string | null
  alcance: Alcance
  es_sistema: number | boolean
  total_usuarios?: number | string
}

interface FilaPermiso extends RowDataPacket {
  rol_id?: number
  recurso: string
  accion: string
}

/**
 * Permisos «recurso:accion» de un rol.
 * Van en su propia consulta a propósito: `JSON_ARRAYAGG` exige privilegio
 * EXECUTE sobre la función y el usuario de la aplicación no lo tiene.
 */
export async function permisosDeRol(rolId: number): Promise<string[]> {
  const filas = await consultar<FilaPermiso>(
    `SELECT recurso, accion FROM rol_permiso WHERE rol_id = ?`,
    [rolId],
  )
  return filas.map((fila) => `${fila.recurso}:${fila.accion}`)
}

/** Todos los permisos agrupados por rol: una sola consulta para los listados. */
async function permisosPorRol(): Promise<Map<number, string[]>> {
  const filas = await consultar<FilaPermiso>(`SELECT rol_id, recurso, accion FROM rol_permiso`)
  const mapa = new Map<number, string[]>()
  for (const fila of filas) {
    const rolId = Number(fila.rol_id)
    const lista = mapa.get(rolId) ?? []
    lista.push(`${fila.recurso}:${fila.accion}`)
    mapa.set(rolId, lista)
  }
  return mapa
}

function aRol(fila: FilaRol, almacenados: readonly string[]): Rol {
  const esSistema = Boolean(fila.es_sistema)
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    alcance: fila.alcance,
    esSistema,
    permisos: permisosEfectivos(almacenados, fila.alcance, esSistema),
  }
}

const COLUMNAS = `r.id, r.nombre, r.descripcion, r.alcance, r.es_sistema`

/** Todos los roles, con cuántas cuentas los usan. El de sistema va primero. */
export async function listarRoles(): Promise<RolConUso[]> {
  const [filas, permisos] = await Promise.all([
    consultar<FilaRol>(
      `SELECT ${COLUMNAS},
              (SELECT COUNT(*) FROM usuario u WHERE u.rol_id = r.id) AS total_usuarios
         FROM rol r
        ORDER BY r.es_sistema DESC, r.nombre`,
    ),
    permisosPorRol(),
  ])
  return filas.map((fila) => ({
    ...aRol(fila, permisos.get(fila.id) ?? []),
    totalUsuarios: Number(fila.total_usuarios ?? 0),
  }))
}

export async function buscarRol(id: number): Promise<Rol | null> {
  const fila = await consultarUno<FilaRol>(`SELECT ${COLUMNAS} FROM rol r WHERE r.id = ?`, [id])
  if (!fila) return null
  return aRol(fila, await permisosDeRol(fila.id))
}

export async function contarUsuariosDeRol(id: number): Promise<number> {
  const fila = await consultarUno<{ total: number }>(
    `SELECT COUNT(*) AS total FROM usuario WHERE rol_id = ?`,
    [id],
  )
  return Number(fila?.total ?? 0)
}

/** Sustituye los permisos del rol por la lista dada (dentro de una transacción). */
async function guardarPermisos(tx: Transaccion, rolId: number, permisos: string[]): Promise<void> {
  await tx.ejecutar(`DELETE FROM rol_permiso WHERE rol_id = ?`, [rolId])
  if (permisos.length === 0) return

  const marcas = permisos.map(() => '(?, ?, ?)').join(', ')
  const valores = permisos.flatMap((texto) => {
    const [recurso, accion] = texto.split(':')
    return [rolId, recurso, accion]
  })
  await tx.ejecutar(`INSERT INTO rol_permiso (rol_id, recurso, accion) VALUES ${marcas}`, valores)
}

export interface DatosRol {
  nombre: string
  descripcion: string | null
  alcance: Alcance
  permisos: string[]
}

/** Crea un rol con todos sus permisos o no crea nada. */
export async function crearRol(datos: DatosRol): Promise<number> {
  return transaccion(async (tx) => {
    const resultado = await tx.ejecutar(
      `INSERT INTO rol (nombre, descripcion, alcance, es_sistema) VALUES (?, ?, ?, 0)`,
      [datos.nombre, datos.descripcion, datos.alcance],
    )
    await guardarPermisos(tx, resultado.insertId, datos.permisos)
    return resultado.insertId
  })
}

export async function actualizarRol(id: number, datos: DatosRol): Promise<void> {
  await transaccion(async (tx) => {
    await tx.ejecutar(`UPDATE rol SET nombre = ?, descripcion = ?, alcance = ? WHERE id = ?`, [
      datos.nombre,
      datos.descripcion,
      datos.alcance,
      id,
    ])
    await guardarPermisos(tx, id, datos.permisos)
  })
}

/** Borra el rol (sus permisos caen en cascada). Falla si hay cuentas con él. */
export async function eliminarRol(id: number): Promise<void> {
  await ejecutar(`DELETE FROM rol WHERE id = ? AND es_sistema = 0`, [id])
}
