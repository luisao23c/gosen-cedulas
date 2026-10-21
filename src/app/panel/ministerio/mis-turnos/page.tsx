import { Alert, Button, Stack } from '@mui/material'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import { exigirSesion } from '@/lib/auth/guardas'
import { listarMisTurnos } from '@/lib/db/eventos'
import { formatearFechaConDia, hoyISO } from '@/lib/fechas'
import { etiquetaLlegada, tonoDeLlegada } from '@/lib/servicio'
import AccionConfirmar from '@/components/AccionConfirmar'
import AccionLlegada from '@/components/AccionLlegada'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Mis turnos · Gosen' }

/**
 * Mis turnos: los eventos en los que YO estoy asignado.
 *
 * Esta pantalla no pide permiso de módulo a propósito: lo que enseña son mis
 * propios turnos y la consulta sale con mi id, tomado de la sesión (nunca de la
 * URL). Confirmar mi asistencia y marcar mi llegada tampoco piden permiso: lo
 * que autoriza es que el turno sea mío.
 */
export default async function PaginaMisTurnos() {
  const usuario = await exigirSesion()
  const hoy = hoyISO()
  const turnos = await listarMisTurnos(usuario.id)

  const pendientes = turnos.filter(
    ({ evento, turno }) => evento.fecha >= hoy && (!turno.confirmado || !turno.llegoEn),
  )

  const filas: FilaListado[] = turnos.map(({ evento, turno }) => {
    const futuro = evento.fecha >= hoy
    return {
      id: turno.id,
      href: `/panel/ministerio/eventos/${evento.id}`,
      grupo: futuro ? (evento.fecha === hoy ? 'Hoy' : 'Próximos') : 'Ya pasaron',
      avatar: {
        texto: String(evento.fecha.slice(8, 10)),
        tono: turno.llegoEn ? 'success' : turno.confirmado ? 'primary' : 'default',
      },
      celdas: [
        { clave: 'evento', etiqueta: 'Evento', texto: evento.nombre, destacado: true },
        { clave: 'fecha', etiqueta: 'Fecha', texto: formatearFechaConDia(evento.fecha) },
        {
          clave: 'lugar',
          etiqueta: 'Lugar',
          texto: evento.ubicacion.direccion ?? 'Sin ubicación marcada',
        },
        {
          clave: 'hora',
          etiqueta: 'Debo estar',
          texto: evento.horaLlegada ?? 'Sin hora definida',
          conEtiqueta: true,
        },
        {
          clave: 'confirmado',
          etiqueta: 'Mi confirmación',
          texto: turno.confirmado ? 'Confirmado' : 'Sin confirmar',
          chip: {
            etiqueta: turno.confirmado ? 'Confirmé' : 'Falta confirmar',
            tono: turno.confirmado ? 'success' : 'default',
          },
        },
        {
          clave: 'llegada',
          etiqueta: 'Mi llegada',
          texto: etiquetaLlegada(turno.llegoEn, evento.fecha, evento.horaLlegada),
          chip: {
            etiqueta: etiquetaLlegada(turno.llegoEn, evento.fecha, evento.horaLlegada),
            tono: tonoDeLlegada(turno.llegoEn, evento.fecha, evento.horaLlegada),
          },
        },
      ],
      acciones: (
        <>
          {futuro && !turno.confirmado ? (
            <AccionConfirmar eventoId={evento.id} confirmado={false} />
          ) : null}
          {futuro && turno.confirmado ? (
            <AccionConfirmar eventoId={evento.id} confirmado />
          ) : null}
          {futuro && turno.confirmado ? (
            <AccionLlegada
              eventoId={evento.id}
              fechaEvento={evento.fecha}
              horaLlegada={evento.horaLlegada}
              puntoEvento={
                evento.ubicacion.latitud != null && evento.ubicacion.longitud != null
                  ? {
                      latitud: evento.ubicacion.latitud,
                      longitud: evento.ubicacion.longitud,
                    }
                  : null
              }
              llegoEn={turno.llegoEn}
              variante="icono"
            />
          ) : null}
        </>
      ),
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Mis turnos"
        etiqueta="Servicio"
        icono={<EventAvailableIcon />}
        subtitulo={`${turnos.length} ${turnos.length === 1 ? 'evento' : 'eventos'} en los que te toca servir.`}
      />

      {pendientes.length > 0 ? (
        <Alert severity="info">
          {pendientes.length === 1
            ? 'Tienes un turno por atender: confírmalo y marca tu llegada el día del evento.'
            : `Tienes ${pendientes.length} turnos por atender: confirma y marca tu llegada el día de cada evento.`}
        </Alert>
      ) : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Evento', 'Fecha', 'Lugar', 'Debo estar', 'Mi confirmación', 'Mi llegada']}
        placeholderBuscador="Buscar evento o lugar…"
        accionesCabecera
        iconoVacio={<EventAvailableIcon />}
        mensajeVacio="No estás asignado a ningún evento. Cuando el encargado del ministerio te agregue a la lista de un evento, aparecerá aquí para que confirmes y marques tu llegada."
      />

      <Button href="/panel/ministerio" sx={{ alignSelf: 'flex-start' }}>
        Volver al ministerio
      </Button>
    </Stack>
  )
}
