/**
 * Piezas compartidas del módulo de ministerio que NO son componentes.
 *
 * Vive aparte de `NavegacionMinisterio.tsx` a propósito: ese archivo es un
 * componente de cliente, y una función exportada desde un módulo `'use client'`
 * no se puede llamar desde un Server Component (Next lo bloquea en tiempo de
 * ejecución). Aquí, en cambio, la pueden usar los dos lados.
 */

/** Secciones del módulo, en orden. */
export const SECCIONES_MINISTERIO = [
  { etiqueta: 'Resumen', ruta: '/panel/ministerio' },
  { etiqueta: 'Equipos', ruta: '/panel/ministerio/equipos' },
  { etiqueta: 'Préstamos', ruta: '/panel/ministerio/prestamos' },
  { etiqueta: 'Eventos', ruta: '/panel/ministerio/eventos' },
  { etiqueta: 'Mis turnos', ruta: '/panel/ministerio/mis-turnos' },
] as const

/** ¿La ruta actual es esta sección (o una pantalla dentro de ella)? */
export function esSeccionActiva(ruta: string, destino: string): boolean {
  if (destino === '/panel/ministerio') return ruta === destino
  return ruta === destino || ruta.startsWith(`${destino}/`)
}

/**
 * Rutas del módulo a las que la cuenta puede entrar. Lo decide el SERVIDOR con
 * los permisos ya resueltos: así no aparece una pestaña que rebotaría.
 */
export function seccionesVisibles(
  tiene: (recurso: 'ministerio' | 'equipo' | 'prestamo' | 'evento', accion: 'ver') => boolean,
  tieneTurnos: boolean,
): string[] {
  const rutas: string[] = []
  if (tiene('ministerio', 'ver') || tiene('equipo', 'ver') || tiene('evento', 'ver')) {
    rutas.push('/panel/ministerio')
  }
  if (tiene('equipo', 'ver')) rutas.push('/panel/ministerio/equipos')
  if (tiene('prestamo', 'ver')) rutas.push('/panel/ministerio/prestamos')
  if (tiene('evento', 'ver')) rutas.push('/panel/ministerio/eventos')
  if (tieneTurnos) rutas.push('/panel/ministerio/mis-turnos')
  return rutas
}
