'use client'

import type { ReactNode } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined'
import { movimiento, radios, sombras } from '@/theme/theme'

/**
 * Cifra grande y tocable del resumen: lleva a la pantalla donde se atiende.
 *
 * Es un atajo, no un listado: el número responde «¿cuánto hay?» y el toque
 * responde «llévame ahí». `aviso` pinta el número en tono de advertencia
 * cuando algo pide atención (p. ej. equipo sin devolver).
 */
export default function TarjetaDato({
  etiqueta,
  valor,
  ayuda,
  href,
  icono,
  aviso = false,
}: {
  etiqueta: string
  valor: number
  ayuda: string
  href: string
  icono: ReactNode
  aviso?: boolean
}) {
  return (
    <ButtonBase
      href={href}
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        gap: 0.5,
        p: { xs: 1.5, sm: 2 },
        borderRadius: `${radios.grande}px`,
        border: 1,
        borderColor: aviso ? 'warning.main' : 'divider',
        bgcolor: 'background.paper',
        boxShadow: sombras.reposo,
        transition: `box-shadow ${movimiento.normal} ${movimiento.curva}, transform ${movimiento.rapida} ${movimiento.curva}`,
        '&:hover': { boxShadow: sombras.suave },
        '&:active': { transform: 'translateY(1px)' },
      }}
    >
      {/* La flecha va arriba, junto al icono: así la etiqueta usa todo el ancho y «Prestados» no se corta */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 32,
            height: 32,
            borderRadius: `${radios.medio}px`,
            bgcolor: aviso ? 'action.hover' : 'primary.light',
            color: aviso ? 'warning.main' : 'primary.dark',
          }}
        >
          {icono}
        </Box>
        <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      </Box>
      <Typography
        variant="h3"
        component="p"
        sx={{ lineHeight: 1.1, color: aviso ? 'warning.main' : 'text.primary' }}
      >
        {valor}
      </Typography>
      <Typography variant="subtitle2" noWrap sx={{ width: '100%' }}>
        {etiqueta}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: { xs: 'none', sm: '-webkit-box' },
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {ayuda}
      </Typography>
    </ButtonBase>
  )
}
