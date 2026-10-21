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
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import GroupIcon from '@mui/icons-material/Group'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import TuneIcon from '@mui/icons-material/Tune'
import LogoutIcon from '@mui/icons-material/Logout'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { tienePermiso, type Accion, type Recurso } from '@/lib/auth/permisos'
import { inicialesDe } from '@/lib/nombres'
import { salir } from '@/features/auth/acciones'
import LogoGosen from '@/components/LogoGosen'
import AvisoProvider from '@/components/AvisoProvider'
import { medidas, movimiento, radios } from '@/theme/theme'

interface ElementoMenu {
  etiqueta: string
  ruta: string
  icono: React.ReactNode
  /** Recurso que hay que poder usar; sin él, la sección está siempre disponible */
  recurso?: Recurso
  /** Acción necesaria sobre ese recurso (por defecto «ver») */
  accion?: Accion
  /** Bloque del menú lateral al que pertenece (sin grupo = suelto, arriba del todo) */
  grupo?: 'Estructura' | 'Servicio' | 'Administración'
}

const ELEMENTOS: ElementoMenu[] = [
  { etiqueta: 'Inicio', ruta: '/panel', icono: <DashboardIcon /> },
  {
    etiqueta: 'Ramas',
    ruta: '/panel/ramas',
    icono: <AccountTreeIcon />,
    recurso: 'rama',
    grupo: 'Estructura',
  },
  {
    etiqueta: 'Células',
    ruta: '/panel/celulas',
    icono: <AssignmentIcon />,
    recurso: 'celula',
    grupo: 'Estructura',
  },
  // El lobby no enseña listados: sirve para dar de alta a quien llega nuevo
  {
    etiqueta: 'Lobby',
    ruta: '/panel/lobby',
    icono: <PersonPinCircleIcon />,
    recurso: 'integrante',
    accion: 'crear',
    grupo: 'Estructura',
  },
  // El ministerio cruza las ramas: equipos, préstamos y eventos de servicio
  {
    etiqueta: 'Ministerio',
    ruta: '/panel/ministerio',
    icono: <VolunteerActivismIcon />,
    recurso: 'ministerio',
    grupo: 'Servicio',
  },
  {
    etiqueta: 'Usuarios',
    ruta: '/panel/usuarios',
    icono: <GroupIcon />,
    recurso: 'usuario',
    grupo: 'Administración',
  },
  {
    etiqueta: 'Roles',
    ruta: '/panel/roles',
    icono: <AdminPanelSettingsIcon />,
    recurso: 'rol',
    grupo: 'Administración',
  },
  // Catálogo de preguntas con las que se recomienda una célula en Lobby
  {
    etiqueta: 'Campos',
    ruta: '/panel/campos',
    icono: <TuneIcon />,
    recurso: 'campo',
    grupo: 'Administración',
  },
]

/** Cuántos destinos caben en la barra inferior del móvil antes de usar «Más». */
const MAXIMO_BARRA_INFERIOR = 4
/** Los destinos que se quedan en la barra cuando hay que recortar (en este orden). */
const PRIORIDAD_BARRA = ['/panel', '/panel/celulas', '/panel/ministerio', '/panel/ramas']

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

  // Barra inferior: con más de 5 destinos se aprietan; los principales se quedan y el resto va en «Más»
  const hayExceso = visibles.length > MAXIMO_BARRA_INFERIOR + 1
  const enBarra = hayExceso
    ? [
        ...PRIORIDAD_BARRA.flatMap((destino) => visibles.filter((elemento) => elemento.ruta === destino)),
        ...visibles.filter((elemento) => !PRIORIDAD_BARRA.includes(elemento.ruta)),
      ]
        .slice(0, MAXIMO_BARRA_INFERIOR)
        .sort((a, b) => visibles.indexOf(a) - visibles.indexOf(b))
    : visibles
  const enMas = visibles.filter((elemento) => !enBarra.includes(elemento))
  const activoEnMas = enMas.some((elemento) => esActiva(ruta, elemento.ruta))
  const [masAbierto, setMasAbierto] = useState(false)

  const cerrarSesion = () => {
    setAncla(null)
    void salir()
  }

  /** Marca: el logo de Gosén y, debajo, el rol de quien tiene la sesión. */
  const marca = (
    <Box sx={{ minWidth: 0 }}>
      <LogoGosen alto={20} />
      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.5 }}>
        {usuario.rolNombre}
      </Typography>
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

      <List sx={{ px: 1.5, pt: 2, display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto' }}>
        {visibles.map((elemento, indice) => {
          const activo = esActiva(ruta, elemento.ruta)
          const abreGrupo = elemento.grupo != null && elemento.grupo !== visibles[indice - 1]?.grupo
          return (
            <Box key={elemento.ruta} component="li" sx={{ display: 'contents' }}>
              {abreGrupo ? (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ px: 1.5, pt: 1.5, pb: 0.25, display: 'block' }}
                >
                  {elemento.grupo}
                </Typography>
              ) : null}
            <ListItemButton
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
            </Box>
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
          {/* `key` por ruta: al cambiar de sección el contenido entra con un fundido corto */}
          <Box
            key={ruta}
            sx={{
              maxWidth: medidas.anchoMaximoContenido,
              mx: 'auto',
              animation: `entradaPagina ${movimiento.normal} ${movimiento.curva} both`,
            }}
          >
            {children}
          </Box>
        </Box>

        {/* Navegación inferior: solo móvil/tablet (patrón Flutter) */}
        <BottomNavigation
          showLabels
          value={
            activoEnMas
              ? 'mas'
              : (enBarra.find((elemento) => esActiva(ruta, elemento.ruta))?.ruta ?? false)
          }
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
          {enBarra.map((elemento) => {
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
          {enMas.length > 0 ? (
            <BottomNavigationAction
              value="mas"
              label="Más"
              onClick={() => setMasAbierto(true)}
              aria-haspopup="dialog"
              icon={
                <Box
                  aria-hidden
                  sx={{
                    width: 52,
                    height: 30,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: `${radios.pill}px`,
                    bgcolor: activoEnMas ? 'primary.light' : 'transparent',
                    color: activoEnMas ? 'primary.main' : 'text.secondary',
                    transition: `background-color ${movimiento.normal} ${movimiento.curva}, color ${movimiento.rapida} ${movimiento.curva}`,
                  }}
                >
                  <MoreHorizIcon />
                </Box>
              }
            />
          ) : null}
        </BottomNavigation>

        {/* Hoja «Más»: el resto de secciones, con zonas táctiles grandes */}
        <Drawer
          anchor="bottom"
          open={masAbierto}
          onClose={() => setMasAbierto(false)}
          slotProps={{
            paper: {
              sx: {
                borderTopLeftRadius: `${radios.extra}px`,
                borderTopRightRadius: `${radios.extra}px`,
                pb: 'max(16px, env(safe-area-inset-bottom))',
              },
            },
          }}
        >
          <Box aria-hidden sx={{ display: 'grid', placeItems: 'center', pt: 1 }}>
            <Box sx={{ width: 40, height: 4, borderRadius: `${radios.pill}px`, bgcolor: 'divider' }} />
          </Box>
          <Typography variant="overline" color="text.secondary" sx={{ px: 3, pt: 1.5, display: 'block' }}>
            Más secciones
          </Typography>
          <List sx={{ px: 1.5 }}>
            {enMas.map((elemento) => {
              const activo = esActiva(ruta, elemento.ruta)
              return (
                <ListItemButton
                  key={elemento.ruta}
                  component={Link}
                  href={elemento.ruta}
                  selected={activo}
                  onClick={() => setMasAbierto(false)}
                  sx={{ gap: 1.5, minHeight: 56 }}
                >
                  <Box
                    aria-hidden
                    sx={{ display: 'flex', color: activo ? 'primary.main' : 'text.secondary' }}
                  >
                    {elemento.icono}
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: activo ? 700 : 500 }}>
                    {elemento.etiqueta}
                  </Typography>
                </ListItemButton>
              )
            })}
          </List>
        </Drawer>
      </Box>
    </AvisoProvider>
  )
}
