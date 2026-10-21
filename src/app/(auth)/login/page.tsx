import { Box, Paper, Stack, Typography } from '@mui/material'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import LogoGosen from '@/components/LogoGosen'
import FormularioLogin from '@/features/auth/FormularioLogin'
import { degradados, radios, sombras } from '@/theme/theme'

export const metadata = { title: 'Entrar · Gosen' }

/** Lo que la aplicación resuelve, en tres líneas: contexto antes de pedir la contraseña. */
const ALCANCES = [
  'Ramas, células y quién las lidera',
  'Integrantes con su ubicación y contacto',
  'Pase de lista y cumpleaños próximos',
]

/** Marca de la aplicación: el logo y su lema. Se usa en las dos columnas. */
function Marca({ sobreMarca = false }: { sobreMarca?: boolean }) {
  return (
    // alignItems: sin esto el logo se estira al ancho de la columna y se deforma
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      <LogoGosen alto={30} variante={sobreMarca ? 'claro' : 'oscuro'} />
      <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>
        Células y ramas
      </Typography>
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
