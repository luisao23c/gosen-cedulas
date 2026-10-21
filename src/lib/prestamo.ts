import type { ConservacionEquipo, Prestamo } from '@/types/domain'
import { ETIQUETAS_CONSERVACION } from '@/types/domain'

/**
 * Fase de un préstamo. Se DEDUCE de las marcas del registro (no se guarda
 * aparte), igual que el estatus «prestado» del equipo:
 *
 *   POR_RECOGER → el ministerio lo apartó, quien lo lleva aún no confirma que lo tiene
 *   PRESTADO    → ya lo recogió y lo tiene
 *   POR_REVISAR → dijo que ya lo devolvió; falta que el ministerio lo reciba
 *   DEVUELTO    → el ministerio lo recibió: el préstamo se cierra
 */
export type FasePrestamo = 'POR_RECOGER' | 'PRESTADO' | 'POR_REVISAR' | 'DEVUELTO'

export function fasePrestamo(
  prestamo: Pick<Prestamo, 'recogidoEn' | 'devolucionAvisadaEn' | 'devueltoEn'>,
): FasePrestamo {
  if (prestamo.devueltoEn) return 'DEVUELTO'
  if (prestamo.devolucionAvisadaEn) return 'POR_REVISAR'
  if (!prestamo.recogidoEn) return 'POR_RECOGER'
  return 'PRESTADO'
}

export type TonoChip = 'success' | 'primary' | 'warning' | 'default'

/** Etiqueta y tono del chip de cada fase (lo único del estado que ve el teléfono en la lista). */
export function chipDeFase(
  fase: FasePrestamo,
  recibidoComo?: ConservacionEquipo | null,
): { etiqueta: string; tono: TonoChip } {
  switch (fase) {
    case 'POR_RECOGER':
      return { etiqueta: 'Por recoger', tono: 'warning' }
    case 'PRESTADO':
      return { etiqueta: 'Prestado', tono: 'primary' }
    case 'POR_REVISAR':
      return { etiqueta: 'Por revisar', tono: 'warning' }
    case 'DEVUELTO':
      return recibidoComo
        ? {
            etiqueta: `Devuelto · ${ETIQUETAS_CONSERVACION[recibidoComo].toLowerCase()}`,
            tono: recibidoComo === 'BUENO' ? 'success' : 'warning',
          }
        : { etiqueta: 'Devuelto', tono: 'success' }
  }
}

/** Frase corta que dice qué sigue en cada fase, desde el punto de vista de quien lo lleva. */
export const SIGUIENTE_PASO_PERSONA: Record<FasePrestamo, string> = {
  POR_RECOGER: 'Recógelo y confirma que ya lo tienes.',
  PRESTADO: 'Cuando lo regreses, avisa que lo devolviste.',
  POR_REVISAR: 'Ya avisaste: falta que el ministerio lo reciba.',
  DEVUELTO: 'Devuelto.',
}
