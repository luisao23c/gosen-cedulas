'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AppBar,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle'
import VideocamIcon from '@mui/icons-material/Videocam'
import GroupIcon from '@mui/icons-material/Group'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import TuneIcon from '@mui/icons-material/Tune'
import LogoutIcon from '@mui/icons-material/Logout'
import { tienePermiso, type Accion, type Recurso } from '@/lib/auth/permisos'
import { inicialesDe } from '@/lib/nombres'
import { salir } from '@/features/auth/acciones'
import AvisoProvider from '@/components/AvisoProvider'
import { degradados, medidas, movimiento, radios, sombras } from '@/theme/theme'

interface ElementoMenu {
  etiqueta: string
  ruta: string
  icono: React.ReactNode
  /** Recurso que hay que poder usar; sin él, la sección está siempre disponible */
  recurso?: Recurso
  /** Acción necesaria sobre ese recurso (por defecto «ver») */
  accion?: Accion
}

const ELEMENTOS: ElementoMenu[] = [
  { etiqueta: 'Inicio', ruta: '/panel', icono: <DashboardIcon /> },
  { etiqueta: 'Ramas', ruta: '/panel/ramas', icono: <AccountTreeIcon />, recurso: 'rama' },
  { etiqueta: 'Células', ruta: '/panel/celulas', icono: <AssignmentIcon />, recurso: 'celula' },
  // El lobby no enseña listados: sirve para dar de alta a quien llega nuevo
  {
    etiqueta: 'Lobby',
    ruta: '/panel/lobby',
    icono: <PersonPinCircleIcon />,
    recurso: 'integrante',
    accion: 'crear',
  },
  // El ministerio cruza las ramas: equipos, préstamos y eventos de servicio
  {
    etiqueta: 'Ministerio',
    ruta: '/panel/ministerio',
    icono: <VideocamIcon />,
    recurso: 'ministerio',
  },
  { etiqueta: 'Usuarios', ruta: '/panel/usuarios', icono: <GroupIcon />, recurso: 'usuario' },
  { etiqueta: 'Roles', ruta: '/panel/roles', icono: <AdminPanelSettingsIcon />, recurso: 'rol' },
  // Catálogo de preguntas con las que se recomienda una célula en Lobby
  { etiqueta: 'Campos', ruta: '/panel/campos', icono: <TuneIcon />, recurso: 'campo' },
]

/** Inicio es la raíz del panel: no debe quedar "activo" en las demás rutas. */
function esActiva(ruta: string, destino: string): boolean {
  if (destino === '/panel') return ruta === '/panel'
  return ruta === destino || ruta.startsWith(`${destino}/`)
}

/**
 * Estructura del panel, con dos caras según el dispositivo:
 *
 *  · Móvil      → AppBar compacta + BottomNavigation estilo Material 3
 *                 (píldora detrás del icono activo), patrón Scaffold de Flutter.
 *  · Escritorio → menú lateral permanente con marca, secciones y tarjeta de
 *                 sesión al pie; la barra superior empieza donde acaba el menú
 *                 (patrón «clipped drawer»: nada queda oculto debajo).
 *
 * El menú se filtra con los MISMOS permisos que aplican las páginas y el
 * servidor (lib/auth/permisos.ts), para no enseñar atajos a los que no puedes entrar.
 */
export default function PanelChrome({
  usuario,
  children,
}: {
  usuario: { nombre: string; rolNombre: string; permisos: string[] }
  children: React.ReactNode
}) {
  const tema = useTheme()
  const esEscritorio = useMediaQuery(tema.breakpoints.up('md'))
  const ruta = usePathname()
  const [ancla, setAncla] = useState<HTMLElement | null>(null)

  const visibles = ELEMENTOS.filter(
    (elemento) =>
      !elemento.recurso || tienePermiso(usuario.permisos, elemento.accion ?? 'ver', elemento.recurso),
  )
  const seccion = visibles.find((elemento) => esActiva(ruta, elemento.ruta))?.etiqueta ?? 'Panel'
  const iniciales = inicialesDe(usuario.nombre)

  const cerrarSesion = () => {
    setAncla(null)
    void salir()
  }

  /** Insignia de marca: identifica la aplicación en el menú y en la barra superior. */
  const marca = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: `${radios.medio}px`,
          backgroundImage: degradados.marca,
          color: 'primary.contrastText',
          boxShadow: sombras.reposo,
        }}
      >
        <AccountTreeIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.2 }}>
          Gosen
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {usuario.rolNombre}
        </Typography>
      </Box>
    </Box>
  )

  const menu = (
    <Box
      sx={{
        width: medidas.anchoMenu,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          height: medidas.altoBarraSuperior.escritorio,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {marca}
      </Box>

      <Box sx={{ px: 1.5, pt: 2.5, pb: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
          Secciones
        </Typography>
      </Box>

      <List sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {visibles.map((elemento) => {
          const activo = esActiva(ruta, elemento.ruta)
          return (
            <ListItemButton
              key={elemento.ruta}
              component={Link}
              href={elemento.ruta}
              selected={activo}
              aria-current={activo ? 'page' : undefined}
              sx={{
                gap: 1,
                px: 1.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  '&:hover': { bgcolor: 'primary.light' },
                },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  display: 'flex',
                  color: activo ? 'primary.main' : 'text.secondary',
                  transition: `color ${movimiento.rapida} ${movimiento.curva}`,
                }}
              >
                {elemento.icono}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: activo ? 700 : 500,
                  color: activo ? 'primary.dark' : 'text.primary',
                }}
              >
                {elemento.etiqueta}
              </Typography>
              {activo ? (
                <Box
                  aria-hidden
                  sx={{ width: 4, height: 20, borderRadius: `${radios.pill}px`, bgcolor: 'primary.main' }}
                />
              ) : null}
            </ListItemButton>
          )
        })}
      </List>

      <Box sx={{ mt: 'auto', p: 1.5 }}>
        <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar sx={{ width: 36, height: 36 }}>{iniciales}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {usuario.nombre}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              Sesión activa
            </Typography>
          </Box>
          <Tooltip title="Cerrar sesión">
            <IconButton size="small" onClick={cerrarSesion} aria-label="Cerrar sesión">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>
      </Box>
    </Box>
  )

  return (
    <AvisoProvider>
      <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
        {/* Barra superior: en escritorio arranca donde termina el menú */}
        <AppBar
          position="fixed"
          sx={{
            width: { md: `calc(100% - ${medidas.anchoMenu}px)` },
            ml: { md: `${medidas.anchoMenu}px` },
            borderBottom: 1,
            borderColor: 'divider',
            pt: 'env(safe-area-inset-top)',
          }}
        >
          <Toolbar
            sx={{
              gap: 1.5,
              minHeight: {
                xs: medidas.altoBarraSuperior.movil,
                md: medidas.altoBarraSuperior.escritorio,
              },
              px: { xs: 2, md: 3 },
            }}
          >
            {/* En móvil la barra es la única referencia estable: marca + sección */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
              {marca}
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 0, display: { xs: 'none', md: 'block' } }}>
              <Typography variant="h6" component="h1" noWrap>
                {seccion}
              </Typography>
            </Box>

            {/* Móvil: el avatar abre el menú de cuenta (más seguro que un icono de salir suelto) */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
              <IconButton
                onClick={(evento) => setAncla(evento.currentTarget)}
                aria-label="Cuenta"
                aria-haspopup="menu"
                edge="end"
              >
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    width: 32,
                    height: 32,
                  }}
                >
                  {iniciales}
                </Avatar>
              </IconButton>
              <Menu anchorEl={ancla} open={Boolean(ancla)} onClose={() => setAncla(null)}>
                <Box sx={{ px: 2, py: 1.25, minWidth: 220 }}>
                  <Typography variant="subtitle2" noWrap>
                    {usuario.nombre}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {usuario.rolNombre}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={cerrarSesion} sx={{ minHeight: medidas.zonaTactil, gap: 1.5 }}>
                  <LogoutIcon fontSize="small" />
                  Cerrar sesión
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Menú lateral: solo escritorio */}
        {esEscritorio ? (
          <Box component="nav" aria-label="Secciones" sx={{ width: medidas.anchoMenu, flexShrink: 0 }}>
            <Drawer
              variant="permanent"
              open
              slotProps={{
                paper: {
                  sx: {
                    width: medidas.anchoMenu,
                    borderRight: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  },
                },
              }}
            >
              {menu}
            </Drawer>
          </Box>
        ) : null}

        {/* Contenido: centrado y con tope de ancho para que no se estire en pantallas grandes */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            px: { xs: 2, sm: 3, md: 4 },
            pt: {
              xs: `calc(${medidas.altoBarraSuperior.movil}px + env(safe-area-inset-top) + 16px)`,
              md: `calc(${medidas.altoBarraSuperior.escritorio}px + 28px)`,
            },
            // hueco para la barra inferior y el botón flotante en móvil
            pb: { xs: 18, md: 6 },
          }}
        >
          <Box sx={{ maxWidth: medidas.anchoMaximoContenido, mx: 'auto' }}>{children}</Box>
        </Box>

        {/* Navegación inferior: solo móvil/tablet (patrón Flutter) */}
        <BottomNavigation
          showLabels
          value={visibles.find((elemento) => esActiva(ruta, elemento.ruta))?.ruta ?? false}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            display: { md: 'none' },
            height: `calc(${medidas.altoBarraInferior}px + env(safe-area-inset-bottom, 0px))`,
            borderTop: 1,
            borderColor: 'divider',
            pb: 'env(safe-area-inset-bottom)',
            zIndex: 'appBar',
          }}
        >
          {visibles.map((elemento) => {
            const activo = esActiva(ruta, elemento.ruta)
            return (
              <BottomNavigationAction
                key={elemento.ruta}
                component={Link}
                href={elemento.ruta}
                value={elemento.ruta}
                label={elemento.etiqueta}
                aria-current={activo ? 'page' : undefined}
                // Píldora del icono activo (Material 3 en lugar de un simple cambio de color)
                icon={
                  <Box
                    aria-hidden
                    sx={{
                      width: 52,
                      height: 30,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: `${radios.pill}px`,
                      bgcolor: activo ? 'primary.light' : 'transparent',
                      color: activo ? 'primary.main' : 'text.secondary',
                      transition: `background-color ${movimiento.normal} ${movimiento.curva}, color ${movimiento.rapida} ${movimiento.curva}`,
                    }}
                  >
                    {elemento.icono}
                  </Box>
                }
              />
            )
          })}
        </BottomNavigation>
      </Box>
    </AvisoProvider>
  )
}
