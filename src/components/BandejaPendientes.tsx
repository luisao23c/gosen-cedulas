import type { ReactNode } from 'react'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import { radios } from '@/theme/theme'

/** Una cosa que le toca hacer a quien tiene la sesión. */
export interface Pendiente {
  clave: string
  icono: ReactNode
  titulo: string
  detalle?: string
  /** A dónde lleva el botón */
  href: string
  /** El verbo del botón: «Pasar lista», «Confirmar», «Recoger»… */
  verbo: string
  /** `urgente` pinta el icono en tono de advertencia (algo que no debe esperar) */
  urgente?: boolean
}

/**
 * Lista de lo que sigue, lo primero que se ve al entrar.
 *
 * Cada fila es UNA tarea con su verbo («Pasar lista», «Recibir»…): la persona
 * no tiene que adivinar en qué sección está lo que necesita hacer. Si no hay
 * nada, lo dice y la pantalla se siente terminada en vez de vacía.
 */
export default function BandejaPendientes({
  pendientes,
  vacio,
}: {
  pendientes: Pendiente[]
  /** Mensaje cuando no hay nada por hacer */
  vacio: string
}) {
  return (
    <Box component="section" aria-labelledby="titulo-pendientes">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1.5 }}>
        <Typography id="titulo-pendientes" variant="h4" component="h2">
          Qué sigue
        </Typography>
        {pendientes.length > 0 ? (
          <Typography variant="body2" color="text.secondary">
            {pendientes.length} {pendientes.length === 1 ? 'pendiente' : 'pendientes'}
          </Typography>
        ) : null}
      </Stack>

      {pendientes.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CheckCircleOutlinedIcon color="success" />
            <Typography variant="body1">{vacio}</Typography>
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden', bgcolor: 'background.paper' }}>
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {pendientes.map((pendiente) => (
              <Box
                key={pendiente.clave}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  flexWrap: 'nowrap',
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: `${radios.medio}px`,
                    bgcolor: pendiente.urgente ? 'action.hover' : 'primary.light',
                    color: pendiente.urgente ? 'warning.main' : 'primary.dark',
                  }}
                >
                  {pendiente.icono}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
                    {pendiente.titulo}
                  </Typography>
                  {pendiente.detalle ? (
                    <Typography variant="body2" color="text.secondary">
                      {pendiente.detalle}
                    </Typography>
                  ) : null}
                </Box>
                <Button
                  href={pendiente.href}
                  variant={pendiente.urgente ? 'contained' : 'outlined'}
                  size="small"
                  sx={{ flexShrink: 0 }}
                >
                  {pendiente.verbo}
                </Button>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  )
}
