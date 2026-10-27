import { Alert, Button, Stack, Typography } from '@mui/material'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivismOutlined'
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined'
import EventIcon from '@mui/icons-material/EventOutlined'
import SwapHorizIcon from '@mui/icons-material/SwapHorizOutlined'
import EventAvailableIcon from '@mui/icons-material/EventAvailableOutlined'
import AccionConfirmar from '@/components/AccionConfirmar'
import AccionLlegada from '@/components/AccionLlegada'
import TarjetaDato from '@/components/TarjetaDato'
import TurnoDestacado from '@/components/TurnoDestacado'
import { tieneEquipoACargo } from '@/lib/db/prestamos'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede, type Recurso } from '@/lib/auth/permisos'
import { listarMinisterios } from '@/lib/db/ministerios'
import { listarPrestamos } from '@/lib/db/prestamos'
import { fasePrestamo } from '@/lib/prestamo'
import { listarEquipos } from '@/lib/db/equipos'
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

/**
 * Inicio del módulo: el panorama de los ministerios a los que llega la cuenta
 * (normalmente uno) y el catálogo, que solo gestiona la organización.
 */
export default async function PaginaMinisterio() {
  const usuario = await exigirRol('ver', 'ministerio')
  const tieneEquipo = await tieneEquipoACargo(usuario.id)
  const hoy = hoyISO()

  const ve = (recurso: Recurso) => rolPuede(usuario, 'ver', recurso)

  const [ministerios, equipos, eventos, misTurnos, miEquipo] = await Promise.all([
    listarMinisterios(usuario),
    ve('equipo') ? listarEquipos(usuario, { incluirBaja: true }) : Promise.resolve([]),
    ve('evento') ? listarEventos(usuario, { desde: hoy }) : Promise.resolve([]),
    listarMisTurnos(usuario.id, { desde: hoy }),
    // Equipo que llevo o me asignaron y todavía no se cierra
    listarPrestamos(usuario, { usuarioId: usuario.id }),
  ])
  const equipoPorAtender = miEquipo.filter((prestamo) => {
    const fase = fasePrestamo(prestamo)
    return fase === 'POR_RECOGER' || fase === 'PRESTADO'
  })

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
          texto: `${equiposDel.length} ${equiposDel.length === 1 ? 'equipo' : 'equipos'}${prestados > 0 ? ` (${prestados} fuera)` : ''}`,
        },
        {
          clave: 'eventos',
          etiqueta: 'Próximos eventos',
          texto: `${proximos} ${proximos === 1 ? 'evento próximo' : 'eventos próximos'}`,
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

  // Quien sirve en UN solo ministerio ve su nombre como título de la pantalla
  const unico = ministerios.length === 1 ? ministerios[0] : null
  const equiposPrestados = equipos.filter((equipo) => equipo.prestado).length

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo={unico ? unico.nombre : ministerios.length > 1 ? 'Ministerios' : 'Ministerio'}
        etiqueta="Servicio"
        icono={<VolunteerActivismIcon />}
        subtitulo={
          unico?.descripcion ??
          'Equipos, préstamos y eventos de servicio de los ministerios a tu alcance.'
        }
      />

      <NavegacionMinisterio
        secciones={seccionesVisibles(
          (recurso, accion) => rolPuede(usuario, accion, recurso),
          misTurnos.length > 0 || tieneEquipo,
        )}
      />

      {proximo ? (
        <TurnoDestacado
          titulo={proximo.evento.nombre}
          cuando={`${proximo.evento.fecha === hoy ? 'Hoy' : formatearFechaConDia(proximo.evento.fecha)}${proximo.evento.horaLlegada ? ` · ${proximo.evento.horaLlegada}` : ''}`}
          lugar={proximo.evento.ubicacion.direccion}
          rol={proximo.turno.funcion}
          confirmado={proximo.turno.confirmado}
          llego={Boolean(proximo.turno.llegoEn)}
          href={`/panel/ministerio/eventos/${proximo.evento.id}`}
        >
          {!proximo.turno.confirmado ? (
            <AccionConfirmar eventoId={proximo.evento.id} confirmado={false} comoBoton />
          ) : proximo.evento.fecha === hoy && !proximo.turno.llegoEn ? (
            <AccionLlegada
              eventoId={proximo.evento.id}
              fechaEvento={proximo.evento.fecha}
              horaLlegada={proximo.evento.horaLlegada}
              puntoEvento={
                proximo.evento.ubicacion.latitud != null && proximo.evento.ubicacion.longitud != null
                  ? {
                      latitud: proximo.evento.ubicacion.latitud,
                      longitud: proximo.evento.ubicacion.longitud,
                    }
                  : null
              }
              llegoEn={proximo.turno.llegoEn}
            />
          ) : (
            <AccionConfirmar eventoId={proximo.evento.id} confirmado comoBoton />
          )}
        </TurnoDestacado>
      ) : null}

      {equipoPorAtender.length > 0 ? (
        <Alert
          severity="warning"
          icon={<Inventory2Icon />}
          action={
            <Button href="/panel/ministerio/mis-turnos" color="inherit" size="small">
              Ver
            </Button>
          }
        >
          {equipoPorAtender.some((prestamo) => fasePrestamo(prestamo) === 'POR_RECOGER')
            ? 'Tienes equipo por recoger: confirma cuando ya lo tengas.'
            : 'Tienes equipo a tu cargo: avisa cuando lo devuelvas.'}
        </Alert>
      ) : null}

      {pendientes.length > 1 ? (
        <Alert
          severity="info"
          icon={<EventAvailableIcon />}
          action={
            <Button href="/panel/ministerio/mis-turnos" color="inherit" size="small">
              Ver todos
            </Button>
          }
        >
          Tienes {pendientes.length} turnos por atender.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={{ xs: 1, sm: 2 }}>
        {ve('equipo') ? (
          <TarjetaDato
            etiqueta="Equipos"
            valor={equipos.length}
            ayuda="en el inventario a tu alcance"
            href="/panel/ministerio/equipos"
            icono={<Inventory2Icon fontSize="small" />}
          />
        ) : null}
        {ve('prestamo') ? (
          <TarjetaDato
            etiqueta="Prestados"
            valor={equiposPrestados}
            ayuda={equiposPrestados > 0 ? 'sin devolver todavía' : 'no hay préstamos abiertos'}
            href="/panel/ministerio/prestamos"
            icono={<SwapHorizIcon fontSize="small" />}
            aviso={equiposPrestados > 0}
          />
        ) : null}
        {ve('evento') ? (
          <TarjetaDato
            etiqueta="Eventos"
            valor={eventos.length}
            ayuda={
              eventos.length > 0
                ? `el más próximo: ${formatearFechaConDia(eventos[eventos.length - 1].fecha)}`
                : 'sin eventos agendados'
            }
            href="/panel/ministerio/eventos"
            icono={<EventIcon fontSize="small" />}
          />
        ) : null}
      </Stack>

      {puedeCrear ? <FormularioMinisterio accion="crear" cuentas={[]} /> : null}

      {/* Quien sirve en un solo ministerio no necesita una lista con uno solo */}
      {puedeCrear || puedeEditar || ministerios.length !== 1 ? (
        <Stack spacing={1}>
          <Typography variant="h4" component="h2">
            Ministerios
          </Typography>
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
      ) : null}
    </Stack>
  )
}
