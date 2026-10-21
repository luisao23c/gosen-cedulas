/**
 * Cumpleaños próximos: la parte de negocio del reporte.
 *
 * Es lógica pura (sin React y sin acceso a datos): recibe personas que ya
 * vienen acotadas por el alcance del rol y devuelve quiénes cumplen años dentro
 * de la ventana elegida, ordenadas por célula y luego por cercanía del día.
 */

import { proximoCumpleanos, type ProximoCumpleanos } from '@/lib/fechas'

/** Ventanas que ofrece la pantalla, en días. */
export const VENTANAS_CUMPLEANOS = [7, 15, 30, 60, 90] as const

/** Ventana que se usa cuando no se pide ninguna. */
export const VENTANA_POR_DEFECTO = 30

/** Ventana pedida por la URL: solo se aceptan las que la pantalla ofrece. */
export function ventanaPedida(valor: string | undefined | null): number {
  const dias = Number(valor)
  return (VENTANAS_CUMPLEANOS as readonly number[]).includes(dias) ? dias : VENTANA_POR_DEFECTO
}

/** «Hoy» · «Mañana» · «En 12 días» */
export function etiquetaFaltan(dias: number): string {
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  return `En ${dias} días`
}

export interface CumpleanosProximo<T> {
  persona: T
  cumple: ProximoCumpleanos
}

/** Lo mínimo que necesita el reporte de una persona. */
export interface PersonaConCumpleanos {
  fechaNacimiento: string | null
  /** Célula a la que pertenece; es el criterio de agrupación */
  nombreCelula: string | null
}

/**
 * Quienes cumplen años dentro de la ventana, ordenados por célula y por día.
 *
 * El filtro por ventana se hace aquí y no en SQL a propósito: la ventana cruza
 * el fin de año y el cálculo del próximo cumpleaños (con el 29 de febrero) es
 * aritmética de fechas, que es justo lo que vive en `lib/fechas.ts`. El alcance
 * del rol —que eso sí es seguridad— ya viene aplicado en el SQL del listado.
 */
export function cumpleanosProximos<T extends PersonaConCumpleanos>(
  personas: T[],
  ventana: number,
  ahora: Date = new Date(),
): CumpleanosProximo<T>[] {
  return personas
    .map((persona) => ({ persona, cumple: proximoCumpleanos(persona.fechaNacimiento, ahora) }))
    .filter(
      (entrada): entrada is CumpleanosProximo<T> =>
        entrada.cumple != null && entrada.cumple.dias <= ventana,
    )
    .sort(
      (a, b) =>
        (a.persona.nombreCelula ?? '').localeCompare(b.persona.nombreCelula ?? '', 'es') ||
        a.cumple.dias - b.cumple.dias,
    )
}
