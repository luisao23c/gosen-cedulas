/**
 * Inserta los roles base (Administrador, Líder de rama, Líder de célula) con
 * sus permisos, tomándolos de src/lib/auth/catalogo.ts. Si un rol con ese
 * nombre ya existe, lo respeta y no toca sus permisos (pueden haberse editado).
 *
 * Lo usan `crear-esquema.mjs` (instalación limpia) y `migrar-roles.mjs`
 * (bases que aún tienen la columna `usuario.rol` antigua).
 *
 * @param conexion conexión mysql2/promise
 * @returns Map nombre → id de cada rol base
 */
import { ROLES_BASE } from '../src/lib/auth/catalogo.ts'

export async function asegurarRolesBase(conexion) {
  const ids = new Map()

  for (const rol of ROLES_BASE) {
    const [existentes] = await conexion.query('SELECT id FROM rol WHERE nombre = ?', [rol.nombre])
    if (existentes.length > 0) {
      ids.set(rol.nombre, existentes[0].id)
      continue
    }

    const [resultado] = await conexion.query(
      'INSERT INTO rol (nombre, descripcion, alcance, es_sistema) VALUES (?, ?, ?, ?)',
      [rol.nombre, rol.descripcion, rol.alcance, rol.esSistema ? 1 : 0],
    )
    const rolId = resultado.insertId

    if (rol.permisos.length > 0) {
      const valores = rol.permisos.map((texto) => {
        const [recurso, accion] = texto.split(':')
        return [rolId, recurso, accion]
      })
      await conexion.query('INSERT INTO rol_permiso (rol_id, recurso, accion) VALUES ?', [valores])
    }
    ids.set(rol.nombre, rolId)
  }

  return ids
}
