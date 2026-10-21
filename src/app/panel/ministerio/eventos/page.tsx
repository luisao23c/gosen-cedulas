import { Stack } from '@mui/material'
import EventIcon from '@mui/icons-material/Event'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { listarEventos, listarMisTurnos } from '@/lib/db/eventos'
import { listarMinisterios } from '@/lib/db/ministerios'
import { formatearFechaConDia, hoyISO } from '@/lib/fechas'
import AccionBaja from '@/components/AccionBaja'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioEvento from '@/components/FormularioEvento'
import NavegacionMinisterio from '@/components/NavegacionMinisterio'
import { seccionesVisibles } from '@/lib/ministerio'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'
import { borrarEvento } from '@/features/ministerio/eventos'

export const instant = false
export const metadata = { title: 'Eventos · Gosen' }

/**
 * Eventos de servicio: cuándo, dónde y quién sirve.
 *
 * Los próximos van primero (agrupados) porque son los que se atienden; los
 * pasados quedan para consultar quién llegó y a qué hora.
 */
export default async function PaginaEventos() {
  const usuario = await exigirRol('ver', 'evento')
  const hoy = hoyISO()

  const [eventos, ministerios, misTurnos] = await Promise.all([
    listarEventos(usuario, { soloActivos: false }),
    listarMinisterios(usuario),
    listarMisTurnos(usuario.id, { desde: hoy }),
  ])

  const ministeriosPermitidos = ministerios.filter((ministerio) =>
    puede(usuario, 'crear', 'evento', { ministerioId: ministerio.id }),
  )

  const filas: FilaListado[] = eventos.map((evento) => {
    const proximo = evento.fecha >= hoy
    const editable = puede(usuario, 'editar', 'evento', { ministerioId: evento.ministerioId })

    return {
      id: evento.id,
      href: `/panel/ministerio/eventos/${evento.id}`,
      grupo: proximo ? 'Próximos' : 'Ya pasaron',
      avatar: {
        texto: String(evento.fecha.slice(8, 10)),
        tono: proximo ? 'primary' : 'default',
      },
      celdas: [
        { clave: 'nombre', etiqueta: 'Evento', texto: evento.nombre, destacado: true },
        { clave: 'fecha', etiqueta: 'Fecha', texto: formatearFechaConDia(evento.fecha) },
        {
          clave: 'hora',
          etiqueta: 'Deben estar',
          texto: evento.horaLlegada ?? 'Sin hora de llegada',
          conEtiqueta: true,
        },
        {
          clave: 'lugar',
          etiqueta: 'Lugar',
          texto: evento.ubicacion.direccion ?? 'Sin ubicación marcada',
        },
        {
          clave: 'servidores',
          etiqueta: 'Sirven',
          texto:
            evento.totalServidores === 0
              ? 'Sin asignar'
              : `${evento.totalServidores} · ${evento.confirmados} confirmaron · ${evento.llegaron} llegaron`,
          conEtiqueta: true,
        },
        {
          clave: 'estado',
          etiqueta: 'Estado',
          texto: evento.activo ? 'Activo' : 'Cancelado',
          chip: {
            etiqueta: evento.activo ? 'Activo' : 'Cancelado',
            tono: evento.activo ? 'success' : 'default',
          },
        },
      ],
      acciones: (
        <>
          {editable ? (
            <FormularioEvento
              accion="editar"
              inicial={{
                id: evento.id,
                nombre: evento.nombre,
                descripcion: evento.descripcion,
                fecha: evento.fecha,
                horaLlegada: evento.horaLlegada,
                ubicacion: evento.ubicacion,
                activo: evento.activo,
              }}
            />
          ) : null}
          {evento.activo && puede(usuario, 'eliminar', 'evento', { ministerioId: evento.ministerioId }) ? (
            <AccionBaja
              accion={borrarEvento}
              id={evento.id}
              queEs="el evento"
              mensajeExito="Evento cancelado"
            />
          ) : null}
        </>
      ),
    }
  })

  const proximos = eventos.filter((evento) => evento.fecha >= hoy).length

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Eventos"
        etiqueta="Ministerio"
        icono={<EventIcon />}
        subtitulo={`${proximos} por venir. En cada evento se arma la lista de quién sirve y cada uno confirma y marca su llegada.`}
      />

      <NavegacionMinisterio
        secciones={seccionesVisibles(
          (recurso, accion) => rolPuede(usuario, accion, recurso),
          misTurnos.length > 0,
        )}
      />

      {ministeriosPermitidos.length > 0 ? (
        <FormularioEvento
          accion="crear"
          ministerioId={ministeriosPermitidos.length === 1 ? ministeriosPermitidos[0].id : undefined}
          ministerios={ministeriosPermitidos.map((ministerio) => ({
            id: ministerio.id,
            nombre: ministerio.nombre,
          }))}
        />
      ) : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Evento', 'Fecha', 'Deben estar', 'Lugar', 'Sirven', 'Estado']}
        placeholderBuscador="Buscar evento, fecha o lugar…"
        accionesCabecera={puede(usuario, 'editar', 'evento')}
        mensajeVacio={
          ministeriosPermitidos.length > 0
            ? 'No hay eventos agendados. Crea el primero con el botón «Nuevo evento»: después podrás asignar a quién le toca servir.'
            : 'No hay eventos a tu alcance.'
        }
      />
    </Stack>
  )
}
