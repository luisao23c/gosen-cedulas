import type { Usuario } from '@/types/domain'
import {
  RANGO_ALCANCE,
  esPermisoValido,
  permiso,
  permisoCompatibleConAlcance,
  todosLosPermisos,
  type Accion,
  type Alcance,
  type Recurso,
} from '@/lib/auth/catalogo'

export type { Accion, Alcance, Recurso } from '@/lib/auth/catalogo'

/**
 * ★ PERMISOS ★
 * Único lugar donde se decide si una cuenta puede hacer algo.
 *
 * Los permisos ya NO son una matriz fija en el código: cada rol los guarda en
 * la base de datos (editables desde /panel/roles) y `lib/db/usuarios.ts` los
 * resuelve en `usuario.permisos`. Qué permisos PUEDEN existir lo fija el
 * catálogo (`lib/auth/catalogo.ts`).
 *
 * Ojo con la costumbre peligrosa: filtrar en la interfaz no es seguridad.
 * Toda página, server action y consulta debe pasar por `puede(...)` o por
 * `dentroDelAlcance(...)` ANTES de leer o escribir datos.
 */

/** Alcance geográfico-organizativo del objeto consultado. */
export interface Ambito {
  /** Rama a la que pertenece el objeto consultado (si aplica) */
  ramaId?: number | null
  /** Célula a la que pertenece el objeto consultado (si aplica) */
  celulaId?: number | null
  /** Ministerio al que pertenece el objeto consultado (equipos, eventos…) */
  ministerioId?: number | null
}

/** Identidad mínima que necesitan las comprobaciones de permisos. */
export type Identidad = Pick<
  Usuario,
  'alcance' | 'permisos' | 'ramaId' | 'celulaId' | 'ministerioId'
>

/**
 * Permisos efectivos de un rol, a partir de lo guardado en la base:
 *  · el rol de sistema (Administrador) siempre tiene TODO el catálogo, así
 *    que un permiso nuevo no deja a los administradores sin acceso;
 *  · se descartan permisos desconocidos y los que el alcance del rol no admite
 *    (defensa en profundidad si alguien tocó la base a mano).
 */
export function permisosEfectivos(
  almacenados: readonly string[],
  alcance: Alcance,
  esSistema: boolean,
): string[] {
  if (esSistema) return todosLosPermisos()
  return Array.from(new Set(almacenados)).filter(
    (texto) => esPermisoValido(texto) && permisoCompatibleConAlcance(texto, alcance),
  )
}

/** ¿Concede esa lista de permisos la acción sobre el recurso? (sin mirar alcance) */
export function tienePermiso(
  permisos: readonly string[],
  accion: Accion,
  recurso: Recurso,
): boolean {
  return permisos.includes(permiso(recurso, accion))
}

/** ¿Tiene la cuenta esa acción sobre ese recurso? (sin mirar alcance) */
export function rolPuede(
  identidad: Pick<Usuario, 'permisos'>,
  accion: Accion,
  recurso: Recurso,
): boolean {
  return tienePermiso(identidad.permisos, accion, recurso)
}

/**
 * ¿Está el objeto dentro del territorio que administra la cuenta?
 * - Organización: todo.
 * - Rama: solo su rama (sea célula, integrante o asistencia de ella).
 * - Célula: solo su célula.
 * - Ministerio: solo lo de su ministerio (equipos, préstamos y eventos).
 *   Ojo: un ministerio no contiene ramas ni células, así que una cuenta de
 *   ministerio NUNCA entra a los datos de una célula (y al revés): cada
 *   recurso se comprueba contra su propio ámbito.
 */
export function dentroDelAlcance(
  usuario: Pick<Usuario, 'alcance' | 'ramaId' | 'celulaId' | 'ministerioId'>,
  ambito: Ambito,
): boolean {
  if (usuario.alcance === 'ORGANIZACION') return true

  if (usuario.alcance === 'RAMA') {
    if (usuario.ramaId == null) return false
    return ambito.ramaId != null && ambito.ramaId === usuario.ramaId
  }

  if (usuario.alcance === 'MINISTERIO') {
    if (usuario.ministerioId == null) return false
    return ambito.ministerioId != null && ambito.ministerioId === usuario.ministerioId
  }

  // CELULA
  if (usuario.celulaId == null) return false
  return ambito.celulaId != null && ambito.celulaId === usuario.celulaId
}

/** Recursos que se administran a nivel de organización, sin objeto territorial. */
const RECURSOS_GLOBALES: ReadonlySet<Recurso> = new Set<Recurso>(['usuario', 'rol'])

/** ¿Puede hacer la acción sobre el objeto, considerando permisos Y alcance? */
export function puede(
  usuario: Identidad,
  accion: Accion,
  recurso: Recurso,
  ambito: Ambito = {},
): boolean {
  if (!rolPuede(usuario, accion, recurso)) return false
  // Cuentas y roles no cuelgan de una rama o célula: la restricción por
  // alcance de lo que se VE va dentro del SQL (ver lib/db/usuarios.ts).
  if (RECURSOS_GLOBALES.has(recurso)) return true
  return dentroDelAlcance(usuario, ambito)
}

/**
 * Anti-escalada de privilegios: una cuenta solo puede dar (o gestionar) un
 * rol si ella misma tiene todos sus permisos y un alcance igual o mayor.
 * Así nadie se concede a sí mismo —ni a un cómplice— más poder del que tiene.
 */
export function puedeOtorgar(
  actor: Pick<Usuario, 'permisos' | 'alcance'>,
  rol: { permisos: readonly string[]; alcance: Alcance },
): boolean {
  if (RANGO_ALCANCE[rol.alcance] > RANGO_ALCANCE[actor.alcance]) return false
  return rol.permisos.every((texto) => actor.permisos.includes(texto))
}
