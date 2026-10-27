import type { ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import SearchOffIcon from '@mui/icons-material/SearchOffOutlined'
import { radios } from '@/theme/theme'

/**
 * Estado vacío único de la app: icono, una frase que dice qué pasó, una explicación breve y, si
 * existe, el siguiente paso como botón. Lo usan los listados (`ListadoResponsivo`) y cualquier
 * pantalla que no tenga nada que mostrar: ninguna arma el suyo a mano.
 */
export default function EstadoVacio({
  titulo,
  mensaje,
  icono,
  accion,
  buscando = false,
}: {
  /** Por defecto: «Nada por aquí todavía» (o «Sin resultados» si se está buscando) */
  titulo?: string
  mensaje: string
  icono?: ReactNode
  /** El siguiente paso: un botón («Agregar integrante», «Limpiar búsqueda»…) */
  accion?: ReactNode
  buscando?: boolean
}) {
  return (
    <Paper
      variant="outlined"
      role="status"
      sx={{
        p: { xs: 3, sm: 4 },
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Box
        aria-hidden
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 56,
          height: 56,
          borderRadius: `${radios.pill}px`,
          bgcolor: 'primary.light',
          color: 'primary.dark',
        }}
      >
        {icono ?? (buscando ? <SearchOffIcon /> : <InboxOutlinedIcon />)}
      </Box>
      <Typography variant="h5" component="p">
        {titulo ?? (buscando ? 'Sin resultados' : 'Nada por aquí todavía')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
        {mensaje}
      </Typography>
      {accion}
    </Paper>
  )
}
