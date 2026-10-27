import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import SearchOffIcon from '@mui/icons-material/SearchOffOutlined'
import { radios } from '@/theme/theme'

export const metadata = { title: 'No encontrado · Gosen' }

/** Página 404 de toda la aplicación (fuera del panel): en español y con el diseño de la casa. */
export default function NoEncontrado() {
  return (
    <Stack sx={{ minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', p: 2 }}>
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
          <SearchOffIcon />
        </Box>
        <Typography variant="h5" component="h1" gutterBottom>
          Esta página no existe
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Revisa que la dirección esté bien escrita o vuelve al inicio.
        </Typography>
        <Button href="/" variant="contained" size="large">
          Ir al inicio
        </Button>
      </Paper>
    </Stack>
  )
}
