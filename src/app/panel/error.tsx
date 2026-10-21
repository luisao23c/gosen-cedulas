'use client'

import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import { radios } from '@/theme/theme'

/**
 * Red de seguridad del panel: si una pantalla falla al cargar (la base no
 * responde, un dato inesperado…), se ve esto en vez de una pantalla en blanco,
 * con un botón para reintentar sin recargar toda la aplicación.
 */
export default function ErrorDelPanel({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Stack sx={{ minHeight: '50vh', alignItems: 'center', justifyContent: 'center' }}>
      <Paper
        variant="outlined"
        sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', maxWidth: 460, width: '100%' }}
      >
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 56,
            height: 56,
            mx: 'auto',
            mb: 2,
            borderRadius: `${radios.pill}px`,
            bgcolor: 'primary.light',
            color: 'primary.dark',
          }}
        >
          <ErrorOutlineOutlinedIcon />
        </Box>
        <Typography variant="h5" component="h1" gutterBottom>
          Algo salió mal
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No pudimos cargar esta pantalla. Puede ser un fallo momentáneo de la conexión; intenta de
          nuevo.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center' }}>
          <Button variant="contained" size="large" onClick={reset}>
            Reintentar
          </Button>
          <Button href="/panel" size="large">
            Volver al inicio
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}
