'use client'

import { forwardRef, useRef, useState, type ReactElement, type ReactNode } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Slide,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import type { TransitionProps } from '@mui/material/transitions'
import CloseIcon from '@mui/icons-material/CloseOutlined'
import { medidas, radios, sombras } from '@/theme/theme'

/** Transición de pantalla completa en móvil: sube desde abajo, como una hoja. */
const SubeDesdeAbajo = forwardRef<unknown, TransitionProps & { children: ReactElement }>(
  function SubeDesdeAbajo(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />
  },
)

/**
 * Diálogo de formulario compartido por todas las pantallas (AGENTS.md §3.5).
 *
 *  · Escritorio → ventana centrada con título, subtítulo opcional y pie con
 *                 «Cancelar» / «Guardar» separados por una línea.
 *  · Móvil      → hoja a pantalla completa que sube desde abajo, con asa de
 *                 arrastre, ✕ a la izquierda y un botón «Guardar» ancho y fijo
 *                 abajo, al alcance del pulgar. El teclado no lo tapa.
 *
 * El error se muestra pegado arriba del contenido para que no quede fuera de
 * la vista en formularios largos.
 */
export default function DialogoFormulario({
  abierto,
  titulo,
  descripcion,
  alCerrar,
  alEnviar,
  pendiente,
  error,
  etiquetaGuardar = 'Guardar',
  anchoMaximo = 'sm',
  accionesExtra,
  completa = false,
  children,
}: {
  abierto: boolean
  titulo: string
  /** Una línea de contexto bajo el título («Se guardará en la célula X») */
  descripcion?: string
  alCerrar: () => void
  /** Se llama con el FormData al enviar (Enter o botón Guardar) */
  alEnviar: (formData: FormData) => void
  pendiente: boolean
  error: string | null
  etiquetaGuardar?: string
  anchoMaximo?: 'sm' | 'md' | 'lg'
  /** Botón extra a la izquierda del pie (p. ej. «Eliminar rol») */
  accionesExtra?: ReactNode
  /**
   * Teléfono: por defecto el formulario es una HOJA INFERIOR (sube desde abajo, deja ver la
   * pantalla detrás y se cierra deslizando, como en una app nativa). Los formularios largos
   * o con mapa piden `completa` y ocupan toda la pantalla.
   */
  completa?: boolean
  children: ReactNode
}) {
  const tema = useTheme()
  const esMovil = useMediaQuery(tema.breakpoints.down('md'))

  // Hoja inferior: se cierra arrastrando la cabecera hacia abajo (el gesto que toda app nativa ofrece)
  const [arrastre, setArrastre] = useState(0)
  const inicioArrastre = useRef<number | null>(null)
  const gestoDeHoja =
    esMovil && !completa
      ? {
          onTouchStart: (evento: React.TouchEvent) => {
            inicioArrastre.current = evento.touches[0].clientY
          },
          onTouchMove: (evento: React.TouchEvent) => {
            if (inicioArrastre.current == null) return
            setArrastre(Math.max(0, evento.touches[0].clientY - inicioArrastre.current))
          },
          onTouchEnd: () => {
            inicioArrastre.current = null
            if (arrastre > 110) alCerrar()
            setArrastre(0)
          },
        }
      : {}

  const botonGuardar = (tamanoGrande: boolean) => (
    <Button
      type="submit"
      variant="contained"
      size={tamanoGrande ? 'large' : 'medium'}
      fullWidth={tamanoGrande}
      disabled={pendiente}
      startIcon={pendiente ? <CircularProgress size={16} color="inherit" /> : undefined}
    >
      {pendiente ? 'Guardando…' : etiquetaGuardar}
    </Button>
  )

  const cuerpo = (
    <Box
      component="form"
      // onSubmit y no `action`: con `action` React vacía el formulario al enviarlo
      // y, si el servidor devuelve un error, se perdería lo que la persona escribió.
      onSubmit={(evento) => {
        evento.preventDefault()
        alEnviar(new FormData(evento.currentTarget))
      }}
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
    >
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: esMovil ? 2 : 1 }}>
        {error ? (
          <Alert severity="error" sx={{ position: 'sticky', top: 0, zIndex: 1, mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {children}
      </DialogContent>

      {esMovil ? (
        <Box
          sx={{
            px: 2,
            pt: 1.5,
            pb: 'max(16px, env(safe-area-inset-bottom))',
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {botonGuardar(true)}
          {accionesExtra}
        </Box>
      ) : (
        <DialogActions
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            px: 3,
            py: 2,
            bgcolor: 'background.paper',
            justifyContent: 'space-between',
          }}
        >
          <Box>{accionesExtra}</Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={alCerrar}>Cancelar</Button>
            {botonGuardar(false)}
          </Box>
        </DialogActions>
      )}
    </Box>
  )

  return (
    <Dialog
      open={abierto}
      onClose={alCerrar}
      fullScreen={esMovil && completa}
      fullWidth
      maxWidth={anchoMaximo}
      scroll="paper"
      slots={esMovil ? { transition: SubeDesdeAbajo } : undefined}
      slotProps={{
        paper: {
          sx: {
            boxShadow: sombras.alta,
            ...(esMovil && !completa
              ? {
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  m: 0,
                  width: '100%',
                  maxWidth: '100%',
                  maxHeight: '92dvh',
                  borderRadius: `${radios.extra}px ${radios.extra}px 0 0`,
                  transform: arrastre > 0 ? `translateY(${arrastre}px)` : undefined,
                  transition: arrastre > 0 ? 'none' : undefined,
                }
              : {}),
          },
        },
      }}
    >
      {esMovil ? (
        <AppBar
          {...gestoDeHoja}
          position="static"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            color: 'text.primary',
            pt: 'env(safe-area-inset-top)',
          }}
        >
          {/* Asa de arrastre: deja claro que es una hoja que se puede cerrar */}
          <Box aria-hidden sx={{ display: 'grid', placeItems: 'center', pt: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 4,
                borderRadius: `${radios.pill}px`,
                bgcolor: 'divider',
              }}
            />
          </Box>
          <Toolbar sx={{ gap: 0.5, minHeight: medidas.zonaTactil, pt: 0.5 }}>
            <IconButton edge="start" onClick={alCerrar} aria-label="Cerrar">
              <CloseIcon />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h2" noWrap>
                {titulo}
              </Typography>
              {descripcion ? (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {descripcion}
                </Typography>
              ) : null}
            </Box>
          </Toolbar>
        </AppBar>
      ) : (
        <Box sx={{ px: { sm: 3 }, pt: 2.5, pb: 0.5 }}>
          <Typography variant="h4" component="h2">
            {titulo}
          </Typography>
          {descripcion ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {descripcion}
            </Typography>
          ) : null}
        </Box>
      )}
      {cuerpo}
    </Dialog>
  )
}
