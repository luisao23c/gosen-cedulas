import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import WifiOffIcon from '@mui/icons-material/WifiOffOutlined'
import { radios } from '@/theme/theme'

export const metadata = { title: 'Sin conexión · Gosen' }

/**
 * Lo que se ve al abrir la app sin red. Es una página estática y pública (el service worker la guarda
 * al instalarse, ver `public/sw.js`): no lee sesión ni datos, y su único botón es un enlace, así que
 * funciona aunque no cargue nada de JavaScript.
 */
export default function PaginaSinConexion() {
  return (
    <Stack sx={{ minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', maxWidth: 460, width: '100%' }}>
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
          <WifiOffIcon />
        </Box>
        <Typography variant="h5" component="h1" gutterBottom>
          Sin conexión
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No hay señal en este momento. Gosén necesita internet para mostrar y guardar los datos: nada de lo que
          captures sin conexión se guarda. Cuando vuelva la señal, reintenta.
        </Typography>
        <Button href="/panel" variant="contained" size="large">
          Reintentar
        </Button>
      </Paper>
    </Stack>
  )
}
