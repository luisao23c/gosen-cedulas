import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import SearchOffIcon from '@mui/icons-material/SearchOffOutlined'
import { radios } from '@/theme/theme'

export const metadata = { title: 'No encontrado · Gosen' }

/**
 * Lo que se ve cuando una ruta del panel apunta a algo que no existe (un id
 * viejo, una célula dada de baja…). Va dentro del panel: el menú sigue ahí.
 */
export default function PanelNoEncontrado() {
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
          <SearchOffIcon />
        </Box>
        <Typography variant="h5" component="h1" gutterBottom>
          No encontramos lo que buscas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Puede que ya no exista o que el enlace esté mal escrito. Regresa al inicio y búscalo desde
          el menú.
        </Typography>
        <Button href="/panel" variant="contained" size="large">
          Volver al inicio
        </Button>
      </Paper>
    </Stack>
  )
}
