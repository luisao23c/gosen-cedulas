import { Alert, Button, Paper, Stack, Typography } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede, type Recurso } from '@/lib/auth/permisos'
import { listarMinisterios } from '@/lib/db/ministerios'
import { listarEquipos } from '@/lib/db/equipos'
import { listarPrestamos } from '@/lib/db/prestamos'
import { listarEventos, listarMisTurnos } from '@/lib/db/eventos'
import { listarUsuarios } from '@/lib/db/usuarios'
import { formatearFechaConDia, hoyISO } from '@/lib/fechas'
import { inicialesDe } from '@/lib/nombres'
import AccionBaja from '@/components/AccionBaja'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioMinisterio from '@/components/FormularioMinisterio'
import NavegacionMinisterio from '@/components/NavegacionMinisterio'
import { seccionesVisibles } from '@/lib/ministerio'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'
import { borrarMinisterio } from '@/features/ministerio/acciones'

export const instant = false
export const metadata = { title: 'Ministerio · Gosen' }

/** Número grande del resumen. No es un listado: son tres cuentas y su etiqueta. */
function Dato({ etiqueta, valor, ayuda }: { etiqueta: string; valor: number; ayuda: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 160 }}>
      <Typography variant="overline" color="text.secondary">
        {etiqueta}
      </Typography>
      <Typography variant="h3" component="p" sx={{ lineHeight: 1.1 }}>
        {valor}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {ayuda}
      </Typography>
    </Paper>
  )
}

/**
 * Inicio del módulo: el panorama de los ministerios a los que llega la cuenta
 * (normalmente uno) y el catálogo, que solo gestiona la organización.
 */
export default async function PaginaMinisterio() {
  const usuario = await exigirRol('ver', 'ministerio')
  const hoy = hoyISO()

  const ve = (recurso: Recurso) => rolPuede(usuario, 'ver', recurso)

  const [ministerios, equipos, prestamos, eventos, misTurnos] = await Promise.all([
    listarMinisterios(usuario),
    ve('equipo') ? listarEquipos(usuario, { incluirBaja: true }) : Promise.resolve([]),
    ve('prestamo') ? listarPrestamos(usuario) : Promise.resolve([]),
    ve('evento') ? listarEventos(usuario, { desde: hoy }) : Promise.resolve([]),
    listarMisTurnos(usuario.id, { desde: hoy }),
  ])

  const puedeCrear = puede(usuario, 'crear', 'ministerio')
  const puedeEditar = puede(usuario, 'editar', 'ministerio')
  const cuentas = puedeEditar ? await listarUsuarios(usuario) : []

  // Turnos que todavía piden algo de mí: confirmar o marcar la llegada
  const pendientes = misTurnos.filter(({ turno }) => !turno.confirmado || !turno.llegoEn)
  const proximo = misTurnos[0]

  const filas: FilaListado[] = ministerios.map((ministerio) => {
    const equiposDel = equipos.filter((equipo) => equipo.ministerioId === ministerio.id)
    const prestados = equiposDel.filter((equipo) => equipo.prestado).length
    const proximos = eventos.filter((evento) => evento.ministerioId === ministerio.id).length
    const editable = puede(usuario, 'editar', 'ministerio', { ministerioId: ministerio.id })

    return {
      id: ministerio.id,
      avatar: {
        texto: inicialesDe(ministerio.nombre),
        tono: ministerio.activo ? 'primary' : 'default',
      },
      celdas: [
        {
          clave: 'nombre',
          etiqueta: 'Ministerio',
          texto: ministerio.nombre,
          destacado: true,
        },
        {
          clave: 'encargado',
          etiqueta: 'Encargado',
          texto: ministerio.nombreEncargado ?? 'Sin encargado',
        },
        {
          clave: 'equipos',
          etiqueta: 'Equipos',
          texto: `${equiposDel.length}${prestados > 0 ? ` · ${prestados} prestado${prestados === 1 ? '' : 's'}` : ''}`,
          conEtiqueta: true,
        },
        {
          clave: 'eventos',
          etiqueta: 'Próximos eventos',
          texto: String(proximos),
          conEtiqueta: true,
        },
        {
          clave: 'estado',
          etiqueta: 'Estado',
          texto: ministerio.activo ? 'Activo' : 'Inactivo',
          chip: {
            etiqueta: ministerio.activo ? 'Activo' : 'Inactivo',
            tono: ministerio.activo ? 'success' : 'default',
          },
        },
      ],
      acciones: (
        <>
          {editable ? (
            <FormularioMinisterio
              accion="editar"
              cuentas={cuentas.map((cuenta) => ({
                id: cuenta.id,
                nombre: cuenta.nombre,
                email: cuenta.email,
                rolNombre: cuenta.rolNombre,
                alcance: cuenta.alcance,
              }))}
              inicial={{
                id: ministerio.id,
                nombre: ministerio.nombre,
                descripcion: ministerio.descripcion,
                encargadoId: ministerio.encargadoId,
                activo: ministerio.activo,
              }}
            />
          ) : null}
          {ministerio.activo && puede(usuario, 'eliminar', 'ministerio', { ministerioId: ministerio.id }) ? (
            <AccionBaja
              accion={borrarMinisterio}
              id={ministerio.id}
              queEs="el ministerio"
              mensajeExito="Ministerio desactivado"
            />
          ) : null}
        </>
      ),
    }
  })

  const equiposPrestados = equipos.filter((equipo) => equipo.prestado).length

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Ministerio"
        etiqueta="Servicio"
        icono={<VideocamIcon />}
        subtitulo="Equipos, préstamos y eventos de servicio de los ministerios a tu alcance."
      />

      <NavegacionMinisterio
        secciones={seccionesVisibles(
          (recurso, accion) => rolPuede(usuario, accion, recurso),
          misTurnos.length > 0,
        )}
      />

      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Dato
          etiqueta="Equipos"
          valor={equipos.length}
          ayuda="en el inventario a tu alcance"
        />
        <Dato
          etiqueta="Prestados"
          valor={equiposPrestados}
          ayuda={prestamos.length > 0 ? 'sin devolver todavía' : 'no hay préstamos abiertos'}
        />
        <Dato
          etiqueta="Eventos por venir"
          valor={eventos.length}
          ayuda={eventos[0] ? `el más próximo: ${formatearFechaConDia(eventos[eventos.length - 1].fecha)}` : 'sin eventos agendados'}
        />
      </Stack>

      {pendientes.length > 0 ? (
        <Alert
          severity="info"
          icon={<EventAvailableIcon />}
          action={
            <Button href="/panel/ministerio/mis-turnos" color="inherit" size="small">
              Ver mis turnos
            </Button>
          }
        >
          Tienes {pendientes.length} {pendientes.length === 1 ? 'turno' : 'turnos'} por atender
          {proximo ? `: ${proximo.evento.nombre}, el ${formatearFechaConDia(proximo.evento.fecha)}` : ''}.
          Confirma tu asistencia y marca tu llegada el día del evento.
        </Alert>
      ) : null}

      {puedeCrear ? <FormularioMinisterio accion="crear" cuentas={[]} /> : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Ministerio', 'Encargado', 'Equipos', 'Próximos eventos', 'Estado']}
        placeholderBuscador="Buscar ministerio o encargado…"
        accionesCabecera={puedeEditar}
        mensajeVacio={
          puedeCrear
            ? 'Todavía no hay ministerios. Crea el primero con el botón «Nuevo ministerio»: dentro de él se lleva el inventario, los préstamos y los eventos de servicio.'
            : 'Aún no hay ministerios a tu alcance. Pídele a la organización que te asigne uno.'
        }
      />
    </Stack>
  )
}
