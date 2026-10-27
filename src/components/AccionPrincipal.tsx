'use client'

import type { ReactNode } from 'react'
import { Button } from '@mui/material'
import { useAccionDeBarra, useHayBarra } from '@/components/CabeceraApp'

/**
 * Acción principal de una pantalla («Nuevo usuario»).
 *
 *  · Teléfono   → botón «+» en la barra superior, arriba a la derecha (como en una app
 *                 nativa). No ocupa lugar en la pantalla ni se encima con la lista.
 *  · Escritorio → botón con texto en la página, alineado a la derecha, arriba de la tabla.
 *
 * Los formularios la usan para no duplicar esta lógica (AGENTS.md §3.5). Si por alguna
 * razón no hay barra que la recoja, se pinta el botón a todo el ancho como respaldo.
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
  useAccionDeBarra({ etiqueta, icono }, alPulsar)
  const hayBarra = useHayBarra()

  return (
    <Button
      variant="contained"
      size="large"
      startIcon={icono}
      onClick={alPulsar}
      sx={{
        display: { xs: hayBarra ? 'none' : 'inline-flex', md: 'inline-flex' },
        width: { xs: '100%', md: 'auto' },
        alignSelf: { xs: 'stretch', md: 'flex-end' },
      }}
    >
      {etiqueta}
    </Button>
  )
}
