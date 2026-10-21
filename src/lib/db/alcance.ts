import type { Usuario } from '@/types/domain'

/**
 * Alcance de los datos de un ministerio, en un solo lugar.
 *
 * Regla de oro (AGENTS.md §3.4): el filtro viaja DENTRO del SQL. Filtrar en la
 * interfaz no es seguridad y, además, un listado no tiene un objeto concreto
 * del que colgar el ámbito.
 *
 * - Organización → ve todos los ministerios.
 * - Ministerio   → solo el suyo.
 * - Rama/célula  → ninguno: un ministerio cruza las ramas, no cuelga de ellas.
 */

export type IdentidadMinisterio = Pick<Usuario, 'alcance' | 'ministerioId'>

/** Condición SQL que limita las filas al alcance de la cuenta. */
export function filtroMinisterio(
  identidad: IdentidadMinisterio,
  /** Columna con el id del ministerio, tal como se llama en la consulta */
  columna = 'ministerio_id',
): { sql: string; parametros: unknown[] } {
  if (identidad.alcance === 'ORGANIZACION') return { sql: '1 = 1', parametros: [] }
  if (identidad.alcance === 'MINISTERIO') {
    if (identidad.ministerioId == null) return { sql: '1 = 0', parametros: [] }
    return { sql: `${columna} = ?`, parametros: [identidad.ministerioId] }
  }
  return { sql: '1 = 0', parametros: [] }
}

/**
 * ¿Cae este ministerio dentro del alcance de la cuenta?
 * Es la comprobación de UN objeto concreto (para páginas y server actions),
 * hermana de `puede(...)` de lib/auth/permisos.ts.
 */
export function dentroDelMinisterio(
  identidad: IdentidadMinisterio,
  ministerioId: number | null | undefined,
): boolean {
  if (ministerioId == null) return false
  if (identidad.alcance === 'ORGANIZACION') return true
  if (identidad.alcance !== 'MINISTERIO') return false
  return identidad.ministerioId === ministerioId
}
