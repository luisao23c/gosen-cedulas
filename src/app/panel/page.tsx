import { Box, Button, CardActionArea, Chip, Paper, Stack, Typography } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle'
import GroupIcon from '@mui/icons-material/Group'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CakeIcon from '@mui/icons-material/Cake'
import AddIcon from '@mui/icons-material/Add'
import { exigirSesion } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { listarRamas } from '@/lib/db/ramas'
import { listarCelulas } from '@/lib/db/celulas'
import { listarUsuarios } from '@/lib/db/usuarios'
import { listarConFechaNacimiento } from '@/lib/db/integrantes'
import { cumpleanosProximos, etiquetaFaltan } from '@/lib/cumpleanos'
import { formatearFecha } from '@/lib/fechas'
import { nombreCompleto } from '@/types/domain'
import { inicialesDe } from '@/lib/nombres'
import { colores, degradados, fuentes, movimiento, radios, sombras } from '@/theme/theme'

export const instant = false
export const metadata = { title: 'Inicio · Gosen' }

/** Tarjeta de cifra: icono, valor grande, contexto y flecha hacia su sección. */
function Cifra({
  titulo,
  valor,
  detalle,
  href,
  icono,
}: {
  titulo: string
  valor: number
  detalle: string
  href: string
  icono: React.ReactNode
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        transition: `box-shadow ${movimiento.normal} ${movimiento.curva}, transform ${movimiento.normal} ${movimiento.curva}, border-color ${movimiento.rapida} linear`,
        '&:hover': {
          boxShadow: sombras.media,
          transform: 'translateY(-2px)',
          borderColor: 'primary.main',
        },
        '&:hover .flecha': { color: 'primary.main', transform: 'translateX(2px)' },
      }}
    >
      <CardActionArea href={href} sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: `${radios.grande}px`,
            bgcolor: 'primary.light',
            color: 'primary.dark',
          }}
        >
          {icono}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            {titulo}
          </Typography>
          <Typography
            variant="h3"
            component="p"
            sx={{ fontFamily: fuentes.numeros, lineHeight: 1.1, fontWeight: 700 }}
          >
            {valor}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {detalle}
          </Typography>
        </Box>
        <ChevronRightIcon
          className="flecha"
          sx={{
            color: 'text.disabled',
            flexShrink: 0,
            transition: `color ${movimiento.rapida} linear, transform ${movimiento.normal} ${movimiento.curva}`,
          }}
        />
      </CardActionArea>
    </Paper>
  )
}

export default async function Panel() {
  const usuario = await exigirSesion()

  // Cada cifra solo se calcula (y se muestra) si el rol puede ver ese recurso
  const veRamas = rolPuede(usuario, 'ver', 'rama')
  const veCelulas = rolPuede(usuario, 'ver', 'celula')
  const veUsuarios = rolPuede(usuario, 'ver', 'usuario')
  const veAsistencia = rolPuede(usuario, 'ver', 'asistencia')
  const veIntegrantes = rolPuede(usuario, 'ver', 'integrante')

  const [ramas, celulas, usuarios, conFechaNacimiento] = await Promise.all([
    veRamas ? listarRamas(usuario, usuario.alcance !== 'ORGANIZACION') : Promise.resolve([]),
    veCelulas ? listarCelulas(usuario, { soloActivas: true }) : Promise.resolve([]),
    veUsuarios ? listarUsuarios(usuario) : Promise.resolve([]),
    veIntegrantes ? listarConFechaNacimiento(usuario) : Promise.resolve([]),
  ])

  // El día que toca: las células que hoy tienen reunión, para pasar lista
  const celulasDeHoy = veAsistencia
    ? celulas.filter((celula) => celula.diaSemana === new Date().getDay())
    : []

  // Los cumpleaños del mes: los cinco más cercanos de los próximos 30 días
  const cumpleanos = cumpleanosProximos(conFechaNacimiento, 30).slice(0, 5)

  const hayAlgo = veRamas || veCelulas || veUsuarios
  const puedeCrearRama = puede(usuario, 'crear', 'rama')
  // Quien puede registrar integrantes tiene su atajo directo al lobby
  const puedeRegistrar = rolPuede(usuario, 'crear', 'integrante')
  const iniciales = inicialesDe(usuario.nombre)

  const accesos = [
    { etiqueta: 'Ramas', href: '/panel/ramas', icono: <AccountTreeIcon fontSize="small" />, visible: veRamas },
    { etiqueta: 'Células', href: '/panel/celulas', icono: <AssignmentIcon fontSize="small" />, visible: veCelulas },
    {
      etiqueta: 'Registrar por ubicación',
      href: '/panel/lobby',
      icono: <PersonPinCircleIcon fontSize="small" />,
      visible: puedeRegistrar,
    },
    {
      etiqueta: 'Cumpleaños',
      href: '/panel/cumpleanos',
      icono: <CakeIcon fontSize="small" />,
      visible: veIntegrantes,
    },
    { etiqueta: 'Usuarios', href: '/panel/usuarios', icono: <GroupIcon fontSize="small" />, visible: veUsuarios },
  ].filter((acceso) => acceso.visible)

  return (
    <Stack spacing={3}>
      {/* Portada: da la bienvenida y sitúa al usuario antes de las cifras */}
      <Paper
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: `${radios.extra}px`,
          backgroundImage: degradados.marca,
          color: 'primary.contrastText',
          boxShadow: sombras.media,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
        >
          <Box
            aria-hidden
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: `${radios.pill}px`,
              bgcolor: colores.veloMarca,
            }}
          >
            <Typography variant="h5" component="span" sx={{ color: 'inherit' }}>
              {iniciales}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" component="h1" sx={{ color: 'inherit' }}>
              Hola, {usuario.nombre}
            </Typography>
            <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.85 }}>
              {usuario.alcance === 'ORGANIZACION'
                ? 'Vista general de toda la organización.'
                : 'Vista general de tu alcance: solo lo que te corresponde.'}
            </Typography>
          </Box>
          <Chip
            label={usuario.rolNombre}
            sx={{
              bgcolor: colores.veloMarca,
              color: 'inherit',
              fontWeight: 700,
              border: `1px solid ${colores.veloMarcaBorde}`,
            }}
          />
        </Stack>
      </Paper>

      {hayAlgo ? (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          }}
        >
          {veRamas ? (
            <Cifra
              titulo="Ramas"
              valor={ramas.length}
              detalle={ramas.length === 1 ? 'rama visible' : 'ramas visibles'}
              href="/panel/ramas"
              icono={<AccountTreeIcon />}
            />
          ) : null}
          {veCelulas ? (
            <Cifra
              titulo="Células"
              valor={celulas.length}
              detalle={celulas.length === 1 ? 'célula activa' : 'células activas'}
              href="/panel/celulas"
              icono={<AssignmentIcon />}
            />
          ) : null}
          {veUsuarios ? (
            <Cifra
              titulo="Cuentas"
              valor={usuarios.length}
              detalle={usuarios.length === 1 ? 'cuenta de acceso' : 'cuentas de acceso'}
              href="/panel/usuarios"
              icono={<GroupIcon />}
            />
          ) : null}
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1">Tu rol todavía no tiene permisos</Typography>
          <Typography color="text.secondary">
            Pide a un administrador que le asigne permisos a tu rol para poder trabajar aquí.
          </Typography>
        </Paper>
      )}

      {celulasDeHoy.length > 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <ChecklistIcon fontSize="small" color="primary" />
              <Typography variant="overline" color="text.secondary">
                Hoy toca reunión
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {celulasDeHoy.length === 1
                ? 'Una de tus células se reúne hoy. Entra a ella para pasar lista.'
                : `${celulasDeHoy.length} de tus células se reúnen hoy. Entra a cada una para pasar lista.`}
            </Typography>
            <Stack spacing={1}>
              {celulasDeHoy.map((celula) => (
                <Button
                  key={celula.id}
                  href={`/panel/celulas/${celula.id}`}
                  variant="outlined"
                  endIcon={<ChevronRightIcon />}
                  sx={{ justifyContent: 'space-between', textAlign: 'left' }}
                >
                  {celula.nombre}
                  {celula.hora ? ` · ${celula.hora}` : ''}
                </Button>
              ))}
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {cumpleanos.length > 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <CakeIcon fontSize="small" color="primary" />
              <Typography variant="overline" color="text.secondary">
                Próximos cumpleaños
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {cumpleanos.length === 1
                ? 'Un integrante cumple años en los próximos 30 días.'
                : 'Estos integrantes cumplen años en los próximos 30 días.'}
            </Typography>
            <Stack spacing={1}>
              {cumpleanos.map(({ persona, cumple }) => (
                <Button
                  key={persona.id}
                  href={`/panel/celulas/${persona.celulaId}`}
                  variant="outlined"
                  endIcon={<ChevronRightIcon />}
                  sx={{ justifyContent: 'space-between', textAlign: 'left' }}
                >
                  {`${nombreCompleto(persona)} · ${etiquetaFaltan(cumple.dias)} (${formatearFecha(cumple.fecha)})`}
                </Button>
              ))}
            </Stack>
            <Button
              href="/panel/cumpleanos"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            >
              Ver todos los cumpleaños
            </Button>
          </Stack>
        </Paper>
      ) : null}

      {accesos.length > 0 || puedeCrearRama ? (
        <Box>
          <Typography variant="overline" color="text.secondary">
            Accesos rápidos
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
            {accesos.map((acceso) => (
              <Button key={acceso.href} href={acceso.href} variant="outlined" startIcon={acceso.icono}>
                {acceso.etiqueta}
              </Button>
            ))}
            {puedeCrearRama ? (
              <Button href="/panel/ramas" variant="contained" startIcon={<AddIcon />}>
                Nueva rama
              </Button>
            ) : null}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  )
}
