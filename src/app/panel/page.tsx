import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivismOutlined'
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined'
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircleOutlined'
import GroupIcon from '@mui/icons-material/GroupOutlined'
import ChecklistIcon from '@mui/icons-material/ChecklistOutlined'
import CakeIcon from '@mui/icons-material/CakeOutlined'
import EventIcon from '@mui/icons-material/EventOutlined'
import InventoryIcon from '@mui/icons-material/InventoryOutlined'
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturnOutlined'
import EventAvailableIcon from '@mui/icons-material/EventAvailableOutlined'
import AddIcon from '@mui/icons-material/AddOutlined'
import { exigirSesion } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { listarRamas } from '@/lib/db/ramas'
import { listarCelulas } from '@/lib/db/celulas'
import { listarUsuarios } from '@/lib/db/usuarios'
import { listarConFechaNacimiento } from '@/lib/db/integrantes'
import { listarEventos, listarMisTurnos } from '@/lib/db/eventos'
import { listarPrestamos } from '@/lib/db/prestamos'
import { fasePrestamo } from '@/lib/prestamo'
import { cumpleanosProximos, etiquetaFaltan } from '@/lib/cumpleanos'
import { formatearFechaConDia, formatearHora, hoyISO } from '@/lib/fechas'
import { nombreCompleto } from '@/types/domain'
import { inicialesDe } from '@/lib/nombres'
import BandejaPendientes, { type Pendiente } from '@/components/BandejaPendientes'
import TarjetaDato from '@/components/TarjetaDato'
import { colores, degradados, radios, sombras } from '@/theme/theme'

export const instant = false
export const metadata = { title: 'Inicio · Gosen' }

/**
 * Inicio: lo primero que se ve es QUÉ LE TOCA HACER a quien entra («Qué sigue»),
 * después los atajos para empezar algo nuevo y, al final y en pequeño, las cifras.
 *
 * Antes era un tablero de contadores (5 ramas, 6 células, 7 cuentas) que ocupaba
 * toda la pantalla del teléfono sin decir qué hacer. Ahora cada tarea trae su
 * verbo («Pasar lista», «Recibir», «Confirmar»…) y lleva directo a donde se hace.
 */
export default async function Panel() {
  const usuario = await exigirSesion()
  const hoy = hoyISO()

  // Cada bloque solo se calcula (y se muestra) si el rol puede ver ese recurso
  const veRamas = rolPuede(usuario, 'ver', 'rama')
  const veCelulas = rolPuede(usuario, 'ver', 'celula')
  const veUsuarios = rolPuede(usuario, 'ver', 'usuario')
  const veAsistencia = rolPuede(usuario, 'ver', 'asistencia')
  const veIntegrantes = rolPuede(usuario, 'ver', 'integrante')
  // Quien solo sirve en un ministerio (servidor, encargado) no ve ramas ni células, pero sí tiene su espacio
  const veMinisterio =
    rolPuede(usuario, 'ver', 'ministerio') ||
    rolPuede(usuario, 'ver', 'equipo') ||
    rolPuede(usuario, 'ver', 'evento')

  const [ramas, celulas, usuarios, conFechaNacimiento, misTurnos, prestamos, eventosDeHoy] =
    await Promise.all([
      veRamas ? listarRamas(usuario, usuario.alcance !== 'ORGANIZACION') : Promise.resolve([]),
      veCelulas ? listarCelulas(usuario, { soloActivas: true }) : Promise.resolve([]),
      veUsuarios ? listarUsuarios(usuario) : Promise.resolve([]),
      veIntegrantes ? listarConFechaNacimiento(usuario) : Promise.resolve([]),
      veMinisterio ? listarMisTurnos(usuario.id, { desde: hoy }) : Promise.resolve([]),
      // Préstamos a mi alcance (el equipo que llevo y, si soy encargado, lo que hay por recibir)
      veMinisterio ? listarPrestamos(usuario) : Promise.resolve([]),
      veMinisterio && rolPuede(usuario, 'ver', 'evento')
        ? listarEventos(usuario, { desde: hoy, hasta: hoy })
        : Promise.resolve([]),
    ])

  /* ── Lo que le toca hacer ───────────────────────────────────── */
  const pendientes: Pendiente[] = []

  // 1) Servicio: lo mío primero (turnos por confirmar y equipo a mi cargo)
  for (const { evento, turno } of misTurnos) {
    if (turno.confirmado) continue
    pendientes.push({
      clave: `turno-${turno.id}`,
      icono: <EventAvailableIcon />,
      titulo: `Confirma tu turno: ${evento.nombre}`,
      detalle: `${evento.fecha === hoy ? 'Hoy' : formatearFechaConDia(evento.fecha)}${evento.horaLlegada ? ` · deben estar a las ${formatearHora(evento.horaLlegada)}` : ''}${turno.funcion ? ` · tu rol: ${turno.funcion}` : ''}`,
      href: '/panel/ministerio/mis-turnos',
      verbo: 'Confirmar',
      urgente: evento.fecha === hoy,
    })
  }
  for (const prestamo of prestamos) {
    const lleva = prestamo.responsableId === usuario.id || prestamo.asignadoAId === usuario.id
    const fase = fasePrestamo(prestamo)
    if (lleva && fase === 'POR_RECOGER') {
      pendientes.push({
        clave: `recoger-${prestamo.id}`,
        icono: <InventoryIcon />,
        titulo: `Recoge «${prestamo.nombreEquipo ?? 'el equipo'}»`,
        detalle: 'Confirma cuando ya lo tengas contigo.',
        href: '/panel/ministerio/mis-turnos',
        verbo: 'Ya lo recogí',
        urgente: true,
      })
    }
  }

  // 2) Servicio: lo que debo atender como encargado (recibir lo que ya devolvieron)
  for (const prestamo of prestamos) {
    if (fasePrestamo(prestamo) !== 'POR_REVISAR') continue
    if (!puede(usuario, 'editar', 'prestamo', { ministerioId: prestamo.ministerioId })) continue
    pendientes.push({
      clave: `recibir-${prestamo.id}`,
      icono: <KeyboardReturnIcon />,
      titulo: `Recibe «${prestamo.nombreEquipo ?? 'el equipo'}»`,
      detalle: `Lo devolvió ${prestamo.nombreAsignado ?? prestamo.nombreResponsable ?? 'quien lo llevaba'}: revísalo y confírmalo.`,
      href: '/panel/ministerio/prestamos',
      verbo: 'Recibir',
      urgente: true,
    })
  }
  for (const evento of eventosDeHoy) {
    if (!puede(usuario, 'editar', 'evento', { ministerioId: evento.ministerioId })) continue
    pendientes.push({
      clave: `evento-${evento.id}`,
      icono: <EventIcon />,
      titulo: `Hoy: ${evento.nombre}`,
      detalle:
        evento.totalServidores === 0
          ? 'Todavía no hay nadie asignado.'
          : `${evento.confirmados} de ${evento.totalServidores} confirmaron · ${evento.llegaron} ya llegaron`,
      href: `/panel/ministerio/eventos/${evento.id}`,
      verbo: 'Ver evento',
    })
  }

  // 3) Células: las que hoy tienen reunión, para pasar lista
  const celulasDeHoy = veAsistencia
    ? celulas.filter((celula) => celula.diaSemana === new Date().getDay())
    : []
  for (const celula of celulasDeHoy) {
    pendientes.push({
      clave: `lista-${celula.id}`,
      icono: <ChecklistIcon />,
      titulo: `Pasa lista en ${celula.nombre}`,
      detalle: `Hoy se reúne${celula.hora ? ` a las ${formatearHora(celula.hora)}` : ''}.`,
      href: `/panel/celulas/${celula.id}`,
      verbo: 'Pasar lista',
    })
  }

  // 4) Cumpleaños de la semana
  const cumpleanosSemana = cumpleanosProximos(conFechaNacimiento, 7).slice(0, 4)
  for (const { persona, cumple } of cumpleanosSemana) {
    pendientes.push({
      clave: `cumple-${persona.id}`,
      icono: <CakeIcon />,
      titulo: `Cumpleaños de ${nombreCompleto(persona)}`,
      detalle: `${etiquetaFaltan(cumple.dias)}.`,
      href: `/panel/celulas/${persona.celulaId}`,
      verbo: 'Ver',
    })
  }

  /* ── Atajos para empezar algo ───────────────────────────────── */
  const puedeCrearRama = puede(usuario, 'crear', 'rama')
  const puedeRegistrar = rolPuede(usuario, 'crear', 'integrante')
  const atajos = [
    {
      etiqueta: 'Registrar persona',
      href: '/panel/lobby',
      icono: <PersonPinCircleIcon />,
      visible: puedeRegistrar,
    },
    { etiqueta: 'Mis células', href: '/panel/celulas', icono: <AssignmentIcon />, visible: veCelulas },
    { etiqueta: 'Ramas', href: '/panel/ramas', icono: <AccountTreeIcon />, visible: veRamas },
    {
      etiqueta: 'Ministerio',
      href: '/panel/ministerio',
      icono: <VolunteerActivismIcon />,
      visible: veMinisterio,
    },
    { etiqueta: 'Cumpleaños', href: '/panel/cumpleanos', icono: <CakeIcon />, visible: veIntegrantes },
    { etiqueta: 'Usuarios', href: '/panel/usuarios', icono: <GroupIcon />, visible: veUsuarios },
  ].filter((atajo) => atajo.visible)

  const tieneAlgo = veRamas || veCelulas || veUsuarios || veMinisterio || veIntegrantes
  const nombrePila = usuario.nombre.split(' ')[0]

  return (
    <Stack spacing={3}>
      {/* Saludo breve: ya no ocupa media pantalla */}
      <Paper
        sx={{
          px: 2.5,
          py: 2,
          borderRadius: `${radios.grande}px`,
          backgroundImage: degradados.marca,
          color: colores.textoSobreMarca,
          boxShadow: sombras.suave,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: `${radios.pill}px`,
              bgcolor: colores.veloMarca,
            }}
          >
            <Typography variant="subtitle1" component="span" sx={{ color: 'inherit' }}>
              {inicialesDe(usuario.nombre)}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" component="h1" noWrap sx={{ color: 'inherit' }}>
              Hola, {nombrePila}
            </Typography>
            <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.85 }}>
              {usuario.alcance === 'ORGANIZACION'
                ? 'Toda la organización'
                : 'Solo lo que te corresponde'}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={usuario.rolNombre}
            sx={{
              bgcolor: colores.veloMarca,
              color: 'inherit',
              fontWeight: 700,
              border: `1px solid ${colores.veloMarcaBorde}`,
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          />
        </Stack>
      </Paper>

      {tieneAlgo ? (
        <BandejaPendientes
          pendientes={pendientes}
          vacio="Estás al día: no hay nada pendiente por ahora."
        />
      ) : (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1">Tu rol todavía no tiene permisos</Typography>
          <Typography color="text.secondary">
            Pide a un administrador que le asigne permisos a tu rol para poder trabajar aquí.
          </Typography>
        </Paper>
      )}

      {atajos.length > 0 || puedeCrearRama ? (
        <Box component="section" aria-labelledby="titulo-atajos">
          <Typography id="titulo-atajos" variant="h4" component="h2" sx={{ mb: 1.5 }}>
            Ir a
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            }}
          >
            {atajos.map((atajo) => (
              <Button
                key={atajo.href}
                href={atajo.href}
                variant="outlined"
                size="large"
                startIcon={atajo.icono}
                sx={{ justifyContent: 'flex-start', minHeight: 56, bgcolor: 'background.paper' }}
              >
                {atajo.etiqueta}
              </Button>
            ))}
            {puedeCrearRama ? (
              <Button
                href="/panel/ramas"
                variant="outlined"
                size="large"
                startIcon={<AddIcon />}
                sx={{ justifyContent: 'flex-start', minHeight: 56, bgcolor: 'background.paper' }}
              >
                Nueva rama
              </Button>
            ) : null}
          </Box>
        </Box>
      ) : null}

      {/* Las cifras, al final y compactas: sirven para ubicarse, no para decidir. Rejilla tipo bento: en el
          teléfono la primera cifra ocupa todo el ancho y las demás van de a dos; en pantalla grande, una fila. */}
      {veRamas || veCelulas || veUsuarios ? (
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1, sm: 2 },
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
            '& > :first-of-type': { gridColumn: { xs: '1 / -1', sm: 'auto' } },
          }}
        >
          {veRamas ? (
            <TarjetaDato
              etiqueta="Ramas"
              valor={ramas.length}
              ayuda={ramas.length === 1 ? 'rama visible' : 'ramas visibles'}
              href="/panel/ramas"
              icono={<AccountTreeIcon fontSize="small" />}
            />
          ) : null}
          {veCelulas ? (
            <TarjetaDato
              etiqueta="Células"
              valor={celulas.length}
              ayuda={celulas.length === 1 ? 'célula activa' : 'células activas'}
              href="/panel/celulas"
              icono={<AssignmentIcon fontSize="small" />}
            />
          ) : null}
          {veUsuarios ? (
            <TarjetaDato
              etiqueta="Cuentas"
              valor={usuarios.length}
              ayuda={usuarios.length === 1 ? 'cuenta de acceso' : 'cuentas de acceso'}
              href="/panel/usuarios"
              icono={<GroupIcon fontSize="small" />}
            />
          ) : null}
        </Box>
      ) : null}
    </Stack>
  )
}
