import { Box, Paper, Stack, Typography } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import FormularioLogin from '@/features/auth/FormularioLogin'
import { colores, degradados, radios, sombras } from '@/theme/theme'

export const metadata = { title: 'Entrar · Gosen' }

/** Lo que la aplicación resuelve, en tres líneas: contexto antes de pedir la contraseña. */
const ALCANCES = [
  'Ramas, células y quién las lidera',
  'Integrantes con su ubicación y contacto',
  'Pase de lista y cumpleaños próximos',
]

/** Marca de la aplicación: insignia + nombre. Se usa en las dos columnas. */
function Marca({ sobreMarca = false }: { sobreMarca?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Box
        aria-hidden
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: `${radios.grande}px`,
          backgroundImage: sobreMarca ? undefined : degradados.marca,
          bgcolor: sobreMarca ? colores.veloMarca : undefined,
          color: 'primary.contrastText',
          boxShadow: sobreMarca ? 'none' : sombras.reposo,
        }}
      >
        <AccountTreeIcon />
      </Box>
      <Box>
        <Typography variant="h5" component="p" sx={{ color: 'inherit', lineHeight: 1.1 }}>
          Gosen
        </Typography>
        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>
          Células y ramas
        </Typography>
      </Box>
    </Stack>
  )
}

export default function PaginaLogin() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        backgroundImage: degradados.ambiente,
      }}
    >
      {/* Panel de marca: solo escritorio */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 4,
          flex: '0 0 44%',
          maxWidth: 620,
          p: 6,
          backgroundImage: degradados.marca,
          color: 'primary.contrastText',
        }}
      >
        <Marca sobreMarca />

        <Box>
          <Typography variant="h2" component="h1" sx={{ color: 'inherit', mb: 1.5 }}>
            La organización, en orden
          </Typography>
          <Typography variant="body1" sx={{ color: 'inherit', opacity: 0.85, maxWidth: 420 }}>
            Gestiona las ramas y células de la comunidad, registra a sus integrantes y pasa lista
            desde el celular.
          </Typography>

          <Stack spacing={1.5} sx={{ mt: 4 }}>
            {ALCANCES.map((texto) => (
              <Stack key={texto} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CheckCircleOutlineOutlinedIcon fontSize="small" sx={{ color: 'inherit', opacity: 0.9 }} />
                <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.9 }}>
                  {texto}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.7 }}>
          Aplicación web instalable · funciona en el móvil durante la reunión
        </Typography>
      </Box>

      {/* Formulario */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 4, md: 6 },
        }}
      >
        <Paper
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3, sm: 4 },
            borderRadius: `${radios.extra}px`,
            boxShadow: sombras.alta,
          }}
        >
          {/* En móvil el panel de marca no se ve: la identidad va aquí */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 3 }}>
            <Marca />
          </Box>

          <Typography variant="h5" component="h2" sx={{ mb: 2.5 }}>
            Iniciar sesión
          </Typography>

          <FormularioLogin />
        </Paper>
      </Box>
    </Box>
  )
}
