import { Alert, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import EventAvailableIcon from '@mui/icons-material/EventAvailableOutlined'
import { exigirSesion } from '@/lib/auth/guardas'
import { listarMisTurnos } from '@/lib/db/eventos'
import { listarPrestamos } from '@/lib/db/prestamos'
import { chipDeFase, fasePrestamo, SIGUIENTE_PASO_PERSONA } from '@/lib/prestamo'
import AccionAvisarDevolucion from '@/components/AccionAvisarDevolucion'
import AccionRecogida from '@/components/AccionRecogida'
import { formatearFechaConDia, hoyISO } from '@/lib/fechas'
import { etiquetaLlegada, tonoDeLlegada } from '@/lib/servicio'
import AccionConfirmar from '@/components/AccionConfirmar'
import AccionLlegada from '@/components/AccionLlegada'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Mi servicio · Gosen' }

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
  const [turnos, prestamos] = await Promise.all([
    listarMisTurnos(usuario.id),
    // Equipo que llevo o que me asignaron y todavía no se cierra
    listarPrestamos(usuario, { usuarioId: usuario.id }),
  ])

  const pendientes = turnos.filter(
    ({ evento, turno }) => evento.fecha >= hoy && (!turno.confirmado || !turno.llegoEn),
  )

  const filas: FilaListado[] = turnos.map(({ evento, turno }) => {
    const futuro = evento.fecha >= hoy
    const marcarLlegada = (variante: 'grande' | 'icono') => (
      <AccionLlegada
        eventoId={evento.id}
        fechaEvento={evento.fecha}
        horaLlegada={evento.horaLlegada}
        puntoEvento={
          evento.ubicacion.latitud != null && evento.ubicacion.longitud != null
            ? { latitud: evento.ubicacion.latitud, longitud: evento.ubicacion.longitud }
            : null
        }
        llegoEn={turno.llegoEn}
        variante={variante}
      />
    )
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
        {
          clave: 'funcion',
          etiqueta: 'Mi rol',
          texto: turno.funcion ?? 'Sin rol definido',
          conEtiqueta: true,
        },
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
      // El paso que toca, a la vista en el teléfono (sin tener que deslizar la fila): primero confirmar y,
      // ya confirmado, marcar la llegada el día del evento
      accionVisible: futuro ? (
        turno.confirmado ? marcarLlegada('grande') : <AccionConfirmar eventoId={evento.id} confirmado={false} comoBoton />
      ) : undefined,
      acciones: (
        <>
          {futuro && !turno.confirmado ? (
            <AccionConfirmar eventoId={evento.id} confirmado={false} />
          ) : null}
          {futuro && turno.confirmado ? (
            <AccionConfirmar eventoId={evento.id} confirmado />
          ) : null}
          {futuro && turno.confirmado ? marcarLlegada('icono') : null}
        </>
      ),
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Mi servicio"
        etiqueta="Servicio"
        icono={<EventAvailableIcon />}
        subtitulo="Tus turnos en eventos y el equipo que tienes a tu cargo."
      />

      {prestamos.length > 0 ? (
        <Stack spacing={1.5}>
          <Typography variant="h4" component="h2">
            Equipo a mi cargo
          </Typography>
          {prestamos.map((prestamo) => {
            const fase = fasePrestamo(prestamo)
            const chip = chipDeFase(fase, prestamo.estadoDevolucion)
            return (
              <Paper key={prestamo.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" sx={{ flex: 1, minWidth: 0 }}>
                      {prestamo.nombreEquipo ?? `Equipo #${prestamo.equipoId}`}
                    </Typography>
                    <Chip size="small" label={chip.etiqueta} color={chip.tono} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {prestamo.nombreEvento ? `Para ${prestamo.nombreEvento}. ` : ''}
                    {SIGUIENTE_PASO_PERSONA[fase]}
                  </Typography>
                  {fase === 'POR_RECOGER' ? (
                    <AccionRecogida
                      prestamoId={prestamo.id}
                      equipo={prestamo.nombreEquipo ?? null}
                      comoBoton
                    />
                  ) : null}
                  {fase === 'PRESTADO' ? (
                    <AccionAvisarDevolucion
                      prestamoId={prestamo.id}
                      equipo={prestamo.nombreEquipo ?? null}
                    />
                  ) : null}
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      ) : null}

      {pendientes.length > 0 ? (
        <Alert severity="info">
          {pendientes.length === 1
            ? 'Tienes un turno por atender: confírmalo y marca tu llegada el día del evento.'
            : `Tienes ${pendientes.length} turnos por atender: confirma y marca tu llegada el día de cada evento.`}
        </Alert>
      ) : null}

      {turnos.length > 0 || prestamos.length === 0 ? (
      <ListadoResponsivo
        filas={filas}
        etiquetas={['Evento', 'Mi rol', 'Fecha', 'Lugar', 'Debo estar', 'Mi confirmación', 'Mi llegada']}
        placeholderBuscador="Buscar evento o lugar…"
        accionesCabecera
        iconoVacio={<EventAvailableIcon />}
        mensajeVacio="No estás asignado a ningún evento. Cuando el encargado del ministerio te agregue a la lista de un evento, aparecerá aquí para que confirmes y marques tu llegada."
      />
      ) : null}

      <Button href="/panel/ministerio" sx={{ alignSelf: 'flex-start' }}>
        Volver al ministerio
      </Button>
    </Stack>
  )
}
