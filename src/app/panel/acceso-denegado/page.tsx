import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { radios } from '@/theme/theme'

export const instant = false
export const metadata = { title: 'Sin permiso · Gosen' }

/** Aterrizaje cuando la comprobación de permisos del servidor rechaza el acceso. */
export default function AccesoDenegado() {
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
          <LockOutlinedIcon />
        </Box>
        <Typography variant="h5" component="h1" gutterBottom>
          No tienes permiso para ver esto
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Tu rol no alcanza ese recurso. Si crees que es un error, habla con un administrador.
        </Typography>
        <Button href="/panel" variant="contained" size="large">
          Volver al inicio
        </Button>
      </Paper>
    </Stack>
  )
}
