import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar } from '@/lib/db/conexion'
import { permisosDeRol } from '@/lib/db/roles'
import { permisosEfectivos } from '@/lib/auth/permisos'
import type { Alcance, Usuario, UsuarioListado } from '@/types/domain'

/**
 * Acceso a datos de `usuario`.
 * Las consultas que reciben una identidad salen YA acotadas a su alcance:
 * no se filtra en la interfaz, se filtra aquí.
 */

interface FilaUsuario extends RowDataPacket {
  id: number
  email: string
  nombre: string
  contrasena_hash?: string
  rol_id: number
  rol_nombre: string
  alcance: Alcance
  es_sistema: number | boolean
  rama_id: number | null
  celula_id: number | null
  ministerio_id: number | null
  activo: number | boolean
}

/** Credencial completa: solo para comprobar la contraseña en el login. */
export interface Credencial extends Usuario {
  contrasenaHash: string
}

/** Columnas comunes; el rol llega por JOIN (alias `r`). */
const COLUMNAS = `u.id, u.email, u.nombre, u.rama_id, u.celula_id, u.ministerio_id, u.activo,
  u.rol_id, r.nombre AS rol_nombre, r.alcance, r.es_sistema`

const DESDE = 'FROM usuario u JOIN rol r ON r.id = u.rol_id'

function aListado(fila: FilaUsuario): UsuarioListado {
  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    rolId: fila.rol_id,
    rolNombre: fila.rol_nombre,
    alcance: fila.alcance,
    esAdmin: Boolean(fila.es_sistema),
    ramaId: fila.rama_id,
    celulaId: fila.celula_id,
    ministerioId: fila.ministerio_id,
    activo: Boolean(fila.activo),
  }
}

function aUsuario(fila: FilaUsuario, almacenados: readonly string[]): Usuario {
  return {
    ...aListado(fila),
    permisos: permisosEfectivos(almacenados, fila.alcance, Boolean(fila.es_sistema)),
  }
}

/**
 * Permisos del rol de una fila. Se piden aparte porque `JSON_ARRAYAGG`
 * exige un privilegio EXECUTE que el usuario de la aplicación no tiene
 * (ver lib/db/roles.ts).
 */
async function permisosDe(fila: FilaUsuario): Promise<string[]> {
  return permisosDeRol(fila.rol_id)
}

/** Usuario por id (para la sesión), con los permisos de su rol resueltos. */
export async function buscarPorId(id: number): Promise<Usuario | null> {
  const fila = await consultarUno<FilaUsuario>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE u.id = ? AND u.activo = 1`,
    [id],
  )
  return fila ? aUsuario(fila, await permisosDe(fila)) : null
}

/** Usuario por correo, con hash incluido. Solo para autenticar. */
export async function buscarCredencial(email: string): Promise<Credencial | null> {
  const fila = await consultarUno<FilaUsuario>(
    `SELECT ${COLUMNAS}, u.contrasena_hash ${DESDE} WHERE u.email = ? AND u.activo = 1`,
    [email.trim().toLowerCase()],
  )
  if (!fila || !fila.contrasena_hash) return null
  return { ...aUsuario(fila, await permisosDe(fila)), contrasenaHash: fila.contrasena_hash }
}

export interface FiltroUsuarios {
  /** Rol concreto a mostrar, o null/sin valor para todos */
  rolId?: number | null
  /** Estado a mostrar, o null/sin valor para todos */
  activo?: boolean | null
}

/**
 * Listado visible para la identidad dada, con filtros opcionales por rol/estado:
 * - Alcance organización → todas las cuentas
 * - Alcance rama         → las de su rama (y las de sus células) + las de organización
 * - Alcance célula       → las de su célula + las de organización
 * La cláusula de alcance SIEMPRE está dentro del SQL: el filtro jamás la sustituye.
 */
export async function listarUsuarios(
  identidad: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId'>,
  filtro: FiltroUsuarios = {},
): Promise<UsuarioListado[]> {
  const condiciones: string[] = []
  const parametros: unknown[] = []

  if (identidad.alcance === 'ORGANIZACION') {
    // sin condición de alcance: ve a todos
  } else if (identidad.alcance === 'RAMA' && identidad.ramaId != null) {
    condiciones.push(
      `(u.rama_id = ?
        OR u.celula_id IN (SELECT id FROM celula WHERE rama_id = ?)
        OR r.alcance = 'ORGANIZACION')`,
    )
    parametros.push(identidad.ramaId, identidad.ramaId)
  } else if (identidad.alcance === 'CELULA' && identidad.celulaId != null) {
    condiciones.push(`(u.celula_id = ? OR r.alcance = 'ORGANIZACION')`)
    parametros.push(identidad.celulaId)
  } else {
    return []
  }

  if (filtro.rolId != null) {
    condiciones.push('u.rol_id = ?')
    parametros.push(filtro.rolId)
  }
  if (filtro.activo != null) {
    condiciones.push('u.activo = ?')
    parametros.push(filtro.activo ? 1 : 0)
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : ''
  const filas = await consultar<FilaUsuario>(
    `SELECT ${COLUMNAS} ${DESDE} ${where} ORDER BY u.nombre`,
    parametros,
  )
  return filas.map(aListado)
}

/** Usuario por id SIN filtrar por activo: necesario para editar o desactivar. */
export async function buscarParaEdicion(id: number): Promise<Usuario | null> {
  const fila = await consultarUno<FilaUsuario>(`SELECT ${COLUMNAS} ${DESDE} WHERE u.id = ?`, [id])
  return fila ? aUsuario(fila, await permisosDe(fila)) : null
}

/**
 * Cuántas cuentas activas con el rol protegido (Administrador) quedan,
 * opcionalmente excluyendo una. Protege contra bloquear la organización
 * desactivando o degradando al último administrador.
 */
export async function contarAdministradoresActivos(excluyendoId?: number): Promise<number> {
  const fila = await consultarUno<{ total: number }>(
    excluyendoId == null
      ? `SELECT COUNT(*) AS total ${DESDE} WHERE r.es_sistema = 1 AND u.activo = 1`
      : `SELECT COUNT(*) AS total ${DESDE} WHERE r.es_sistema = 1 AND u.activo = 1 AND u.id <> ?`,
    excluyendoId == null ? [] : [excluyendoId],
  )
  return Number(fila?.total ?? 0)
}

/** Crea un usuario. El correo se guarda en minúsculas y es único. */
export async function crearUsuario(datos: {
  email: string
  nombre: string
  contrasenaHash: string
  rolId: number
  ramaId: number | null
  celulaId: number | null
  ministerioId: number | null
}): Promise<number> {
  const resultado = await ejecutar(
    `INSERT INTO usuario (email, nombre, contrasena_hash, rol_id, rama_id, celula_id, ministerio_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.email.trim().toLowerCase(),
      datos.nombre.trim(),
      datos.contrasenaHash,
      datos.rolId,
      datos.ramaId,
      datos.celulaId,
      datos.ministerioId,
    ],
  )
  return resultado.insertId
}

export async function actualizarUsuario(
  id: number,
  datos: {
    nombre: string
    rolId: number
    ramaId: number | null
    celulaId: number | null
    ministerioId: number | null
    activo: boolean
  },
): Promise<void> {
  await ejecutar(
    `UPDATE usuario SET nombre = ?, rol_id = ?, rama_id = ?, celula_id = ?, ministerio_id = ?, activo = ?
     WHERE id = ?`,
    [
      datos.nombre.trim(),
      datos.rolId,
      datos.ramaId,
      datos.celulaId,
      datos.ministerioId,
      datos.activo ? 1 : 0,
      id,
    ],
  )
}

/** Cambio de contraseña por parte del propio usuario o un administrador. */
export async function cambiarContrasena(id: number, contrasenaHash: string): Promise<void> {
  await ejecutar(`UPDATE usuario SET contrasena_hash = ? WHERE id = ?`, [contrasenaHash, id])
}
