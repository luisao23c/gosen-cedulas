'use client'

import type { ReactNode } from 'react'
import { Box, Chip, Stack, Typography } from '@mui/material'
import PlaceIcon from '@mui/icons-material/Place'
import ScheduleIcon from '@mui/icons-material/Schedule'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { degradados, radios, sombras } from '@/theme/theme'

/**
 * El turno que toca atender ahora, en grande y con su acción a la mano.
 *
 * Responde de un vistazo a las tres preguntas del servidor: qué evento es y a
 * qué hora hay que estar, cuál es mi rol, y qué me falta por hacer (confirmar
 * → marcar llegada). La acción principal viene de fuera (`children`) para que
 * el servidor siga siendo quien decide qué botón corresponde.
 */
export default function TurnoDestacado({
  titulo,
  cuando,
  lugar,
  rol,
  confirmado,
  llego,
  href,
  children,
}: {
  titulo: string
  /** «Hoy · 14:07», «Martes 20 de octubre · 14:07» */
  cuando: string
  lugar: string | null
  rol: string | null
  confirmado: boolean
  llego: boolean
  /** Detalle del evento */
  href: string
  /** La acción que corresponde: confirmar o marcar llegada */
  children?: ReactNode
}) {
  const paso = (hecho: boolean, texto: string) => (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      {hecho ? (
        <CheckCircleIcon fontSize="small" />
      ) : (
        <RadioButtonUncheckedIcon fontSize="small" sx={{ opacity: 0.7 }} />
      )}
      <Typography variant="body2" sx={{ fontWeight: hecho ? 700 : 500, opacity: hecho ? 1 : 0.85 }}>
        {texto}
      </Typography>
    </Stack>
  )

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: `${radios.extra}px`,
        backgroundImage: degradados.marca,
        color: 'primary.contrastText',
        boxShadow: sombras.media,
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="overline" sx={{ opacity: 0.85 }}>
          Tu próximo turno
        </Typography>

        <Box>
          <Typography
            variant="h2"
            component="h2"
            sx={{ '& a': { color: 'inherit', textDecoration: 'none' } }}
          >
            <a href={href}>{titulo}</a>
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.75 }}>
            <ScheduleIcon fontSize="small" />
            <Typography variant="body1">{cuando}</Typography>
          </Stack>
          {lugar ? (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start', mt: 0.5 }}>
              <PlaceIcon fontSize="small" />
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {lugar}
              </Typography>
            </Stack>
          ) : null}
        </Box>

        {rol ? (
          <Chip
            size="small"
            label={`Tu rol: ${rol}`}
            sx={{ alignSelf: 'flex-start', bgcolor: 'secondary.main', color: 'secondary.contrastText' }}
          />
        ) : null}

        <Stack direction="row" spacing={2.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {paso(confirmado, 'Confirmado')}
          {paso(llego, 'Llegada marcada')}
        </Stack>

        {children ? (
          <Box
            sx={{
              p: 1,
              borderRadius: `${radios.grande}px`,
              bgcolor: 'background.paper',
              color: 'text.primary',
            }}
          >
            {children}
          </Box>
        ) : null}
      </Stack>
    </Box>
  )
}
