import { notFound } from 'next/navigation'
import { Box, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material'
import EventIcon from '@mui/icons-material/EventOutlined'
import PlaceIcon from '@mui/icons-material/PlaceOutlined'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { buscarEvento, listarAsignables, listarTurnos } from '@/lib/db/eventos'
import { listarPrestamos } from '@/lib/db/prestamos'
import { chipDeFase, fasePrestamo } from '@/lib/prestamo'
import { formatearFechaConDia, formatearFecha } from '@/lib/fechas'
import { distanciaKm, distanciaLegible } from '@/lib/geo'
import { etiquetaLlegada, horaDeInstante, tonoDeLlegada } from '@/lib/servicio'
import { inicialesDe } from '@/lib/nombres'
import AccionConfirmar from '@/components/AccionConfirmar'
import AccionLlegada from '@/components/AccionLlegada'
import AccionFuncion from '@/components/AccionFuncion'
import AccionQuitarServidor from '@/components/AccionQuitarServidor'
import AsignarServidores from '@/components/AsignarServidores'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioEvento from '@/components/FormularioEvento'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'
import MapaUbicacion from '@/components/MapaUbicacion'

export const instant = false

export async function generateMetadata({ params }: { params: Promise<{ eventoId: string }> }) {
  const { eventoId } = await params
  return { title: `Evento ${eventoId} · Gosen` }
}

/**
 * Detalle del evento: dónde es, a qué hora deben estar y la lista de quién
 * sirve, con la confirmación y la hora de llegada de cada uno.
 *
 * Aquí se ve lo que el usuario pidió: si alguien llegó a tiempo (contra la hora
 * del evento) y dónde checó (contra el punto del evento).
 */
export default async function PaginaEvento({
  params,
}: {
  params: Promise<{ eventoId: string }>
}) {
  const { eventoId } = await params
  const id = Number(eventoId)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const usuario = await exigirRol('ver', 'evento')
  const evento = await buscarEvento(id, usuario)
  // Fuera del alcance no se distingue de «no existe»: ni pistas de lo ajeno.
  if (!evento) notFound()

  const [turnos, cuentas, prestamos] = await Promise.all([
    listarTurnos(evento.id),
    listarAsignables(evento.ministerioId),
    // Solo quien puede ver préstamos ve el equipo que salió para el evento
    rolPuede(usuario, 'ver', 'prestamo')
      ? listarPrestamos(usuario, { soloAbiertos: false, eventoId: evento.id })
      : Promise.resolve([]),
  ])

  const ambito = { ministerioId: evento.ministerioId }
  const puedeAsignar = puede(usuario, 'asignar', 'evento', ambito)
  const puedeChecar = puede(usuario, 'checar', 'evento', ambito)
  const puedeEditar = puede(usuario, 'editar', 'evento', ambito)
  const puedoPasarLista = puedeAsignar

  const punto = evento.ubicacion
  const filas: FilaListado[] = turnos.map((turno) => {
    // El turno propio se confirma y se checa sin permiso especial: lo autoriza
    // la asignación (el servidor comprueba que el turno sea suyo), y así la
    // primera persona («Confirmo que voy») solo aparece cuando es de verdad.
    const esMiTurno = turno.usuarioId === usuario.id
    const distancia =
      punto.latitud != null && punto.longitud != null && turno.ubicacion.latitud != null && turno.ubicacion.longitud != null
        ? distanciaKm(
            { latitud: punto.latitud, longitud: punto.longitud },
            { latitud: turno.ubicacion.latitud, longitud: turno.ubicacion.longitud },
          )
        : null

    return {
      id: turno.id,
      avatar: {
        texto: inicialesDe(turno.nombreUsuario ?? 'Servidor'),
        tono: turno.llegoEn ? 'success' : turno.confirmado ? 'primary' : 'default',
      },
      celdas: [
        {
          clave: 'nombre',
          etiqueta: 'Servidor',
          texto: turno.nombreUsuario ?? `Cuenta #${turno.usuarioId}`,
          destacado: true,
        },
        {
          clave: 'funcion',
          etiqueta: 'Rol',
          texto: turno.funcion ?? 'Sin rol',
        },
        {
          clave: 'confirmado',
          etiqueta: 'Confirmó',
          texto: turno.confirmado
            ? `Sí${turno.confirmadoEn ? ` · ${formatearFecha(turno.confirmadoEn)}` : ''}`
            : 'Sin confirmar',
          chip: {
            etiqueta: turno.confirmado ? 'Confirmó' : 'Sin confirmar',
            tono: turno.confirmado ? 'success' : 'default',
          },
        },
        {
          clave: 'llegada',
          etiqueta: 'Llegada',
          texto: etiquetaLlegada(turno.llegoEn, evento.fecha, evento.horaLlegada),
          chip: {
            etiqueta: etiquetaLlegada(turno.llegoEn, evento.fecha, evento.horaLlegada),
            tono: tonoDeLlegada(turno.llegoEn, evento.fecha, evento.horaLlegada),
          },
        },
        {
          clave: 'distancia',
          etiqueta: 'Del punto',
          texto: distancia != null ? distanciaLegible(distancia) : '—',
          conEtiqueta: true,
        },
        {
          clave: 'registro',
          etiqueta: 'Registró',
          texto:
            turno.llegoEn && turno.registradoPorId && turno.registradoPorId !== turno.usuarioId
              ? 'El encargado (marcó por él)'
              : turno.llegoEn
                ? 'Él mismo'
                : '—',
        },
      ],
      acciones: (
        <>
          {puedeChecar || esMiTurno ? (
            <AccionLlegada
              eventoId={evento.id}
              usuarioId={esMiTurno ? undefined : turno.usuarioId}
              nombreServidor={esMiTurno ? null : turno.nombreUsuario}
              fechaEvento={evento.fecha}
              horaLlegada={evento.horaLlegada}
              puntoEvento={
                punto.latitud != null && punto.longitud != null
                  ? { latitud: punto.latitud, longitud: punto.longitud }
                  : null
              }
              llegoEn={turno.llegoEn}
              variante="icono"
            />
          ) : null}
          {puedeEditar || esMiTurno ? (
            <AccionConfirmar
              eventoId={evento.id}
              usuarioId={esMiTurno ? undefined : turno.usuarioId}
              confirmado={turno.confirmado}
            />
          ) : null}
          {puedeAsignar ? (
            <AccionFuncion
              eventoId={evento.id}
              usuarioId={turno.usuarioId}
              nombre={turno.nombreUsuario ?? 'esta persona'}
              funcion={turno.funcion}
            />
          ) : null}
          {puedoPasarLista ? (
            <AccionQuitarServidor
              eventoId={evento.id}
              usuarioId={turno.usuarioId}
              nombre={turno.nombreUsuario ?? 'esta persona'}
            />
          ) : null}
        </>
      ),
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo={evento.nombre}
        etiqueta="Evento de servicio"
        icono={<EventIcon />}
        volver={{ href: '/panel/ministerio/eventos', etiqueta: 'Eventos' }}
        subtitulo={`${formatearFechaConDia(evento.fecha)}${evento.horaLlegada ? ` · deben estar a las ${evento.horaLlegada}` : ' · sin hora de llegada definida'}`}
      >
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <AsignarServidores
            eventoId={evento.id}
            cuentas={cuentas.map((cuenta) => ({
              id: cuenta.id,
              nombre: cuenta.nombre,
              email: cuenta.email,
            }))}
            asignados={turnos.map((turno) => turno.usuarioId)}
            puede={puedeAsignar}
          />
          {puedeEditar ? (
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
        </Stack>
      </EncabezadoPagina>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2}>
          <Stack spacing={1}>
            {/* El pin y la dirección van juntos: si cada uno fuera un elemento suelto de la fila, el pin quedaba solo en su renglón */}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <PlaceIcon fontSize="small" color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
              <Typography variant="subtitle1">
                {punto.direccion ?? 'Sin ubicación marcada: la llegada se mide solo por la hora'}
              </Typography>
            </Stack>
            {evento.horaLlegada ? (
              <Chip
                size="small"
                color="primary"
                label={`Deben estar a las ${evento.horaLlegada}`}
                sx={{ alignSelf: 'flex-start' }}
              />
            ) : (
              <Chip size="small" variant="outlined" label="Sin hora de llegada" sx={{ alignSelf: 'flex-start' }} />
            )}
          </Stack>

          {turnos.length > 0 ? (
            <Stack spacing={1.5}>
              {[
                { etiqueta: 'Confirmaron', cuantos: turnos.filter((turno) => turno.confirmado).length },
                { etiqueta: 'Ya llegaron', cuantos: turnos.filter((turno) => turno.llegoEn).length },
              ].map(({ etiqueta, cuantos }) => (
                <Box key={etiqueta}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {etiqueta}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {cuantos} de {turnos.length}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(cuantos / turnos.length) * 100}
                    aria-label={`${etiqueta}: ${cuantos} de ${turnos.length}`}
                    color={cuantos === turnos.length ? 'success' : 'primary'}
                  />
                </Box>
              ))}
              {turnos.some((turno) => turno.llegoEn) ? (
                <Typography variant="caption" color="text.secondary">
                  Último registro:{' '}
                  {horaDeInstante(
                    turnos
                      .map((turno) => turno.llegoEn)
                      .filter((valor): valor is string => Boolean(valor))
                      .sort()
                      .at(-1) ?? null,
                  ) ?? '—'}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Servidor', 'Rol', 'Confirmó', 'Llegada', 'Del punto', 'Registró']}
        placeholderBuscador="Buscar servidor…"
        accionesCabecera={puedeChecar || puedeEditar}
        mensajeVacio={
          puedeAsignar
            ? 'Todavía no hay nadie asignado. Usa «Asignar servidores» para armar la lista de quién sirve en este evento.'
            : 'Este evento no tiene servidores asignados.'
        }
      />

      {/* El mapa va DESPUÉS de la lista: en el teléfono, lo que se atiende (quién confirmó
          y quién llegó) no debe quedar enterrado bajo un mapa de pantalla completa. */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">Punto de reunión</Typography>
          {punto.latitud != null && punto.longitud != null ? (
            <MapaUbicacion
              latitud={punto.latitud}
              longitud={punto.longitud}
              soloLectura
              etiqueta={`Ubicación de ${evento.nombre}`}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Este evento no tiene punto marcado en el mapa. Al editarlo puedes marcar dónde tienen
              que estar; con ese punto se mide dónde checa su llegada cada servidor.
            </Typography>
          )}
        </Stack>
      </Paper>

      {prestamos.length > 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1">Equipo que salió para este evento</Typography>
            {prestamos.map((prestamo) => {
              const chip = chipDeFase(fasePrestamo(prestamo), prestamo.estadoDevolucion)
              return (
                <Stack
                  key={prestamo.id}
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {prestamo.nombreEquipo ?? `Equipo #${prestamo.equipoId}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    lo lleva {prestamo.nombreAsignado ?? prestamo.nombreResponsable ?? '—'}
                  </Typography>
                  <Chip size="small" color={chip.tono} label={chip.etiqueta} />
                </Stack>
              )
            })}
          </Stack>
        </Paper>
      ) : null}

      <Box>
        <Typography variant="caption" color="text.secondary">
          Cada servidor confirma desde su cuenta y el día del evento marca su llegada con la
          ubicación de su teléfono. La hora y el punto quedan guardados, así que se ve quién llegó a
          tiempo y dónde checó. El encargado puede marcar por quien no traiga teléfono, y queda
          anotado quién lo hizo.
        </Typography>
      </Box>
    </Stack>
  )
}
