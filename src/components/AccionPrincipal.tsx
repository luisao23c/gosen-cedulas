'use client'

import type { ReactNode } from 'react'
import { Button } from '@mui/material'

/**
 * Acción principal de una pantalla («Nuevo usuario»).
 *
 * Es un botón dentro del flujo de la página, ARRIBA de la lista o tabla:
 *  · Escritorio → botón de tamaño normal, alineado a la izquierda
 *  · Móvil      → botón a todo el ancho (zona táctil grande), antes del buscador
 *
 * Antes en móvil era un botón flotante fijo sobre la barra inferior, pero se
 * encimaba con las últimas filas de la lista y tapaba su contenido. Al ir en el
 * flujo nunca cubre nada.
 *
 * Los formularios la usan para no duplicar esta lógica (AGENTS.md §3.5).
 * El degradado, el radio y la sombra del botón salen del tema.
 */
export default function AccionPrincipal({
  etiqueta,
  icono,
  alPulsar,
}: {
  etiqueta: string
  icono: ReactNode
  alPulsar: () => void
}) {
  return (
    <Button
      variant="contained"
      size="large"
      startIcon={icono}
      onClick={alPulsar}
      sx={{ width: { xs: '100%', md: 'auto' }, alignSelf: { xs: 'stretch', md: 'flex-start' } }}
    >
      {etiqueta}
    </Button>
  )
}
