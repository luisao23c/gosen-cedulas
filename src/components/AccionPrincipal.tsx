'use client'

import type { ReactNode } from 'react'
import { Button, Fab } from '@mui/material'
import { medidas, sobreBarraInferior } from '@/theme/theme'

/**
 * Acción principal de una pantalla («Nuevo usuario»):
 *  · Escritorio → botón de la cabecera (arranca alineado a la izquierda de su fila)
 *  · Móvil      → botón flotante extendido sobre la barra inferior, al alcance
 *                 del pulgar y por encima de ella (medidas del tema)
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
    <>
      <Button
        variant="contained"
        size="large"
        startIcon={icono}
        onClick={alPulsar}
        sx={{ display: { xs: 'none', md: 'inline-flex' }, alignSelf: 'flex-start' }}
      >
        {etiqueta}
      </Button>
      <Fab
        variant="extended"
        color="primary"
        aria-label={etiqueta}
        onClick={alPulsar}
        sx={{
          position: 'fixed',
          right: medidas.margenFab,
          bottom: sobreBarraInferior,
          display: { xs: 'inline-flex', md: 'none' },
          zIndex: 'speedDial',
        }}
      >
        {icono}
        {etiqueta}
      </Fab>
    </>
  )
}
