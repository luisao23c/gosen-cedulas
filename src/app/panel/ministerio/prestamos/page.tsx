import { Stack } from '@mui/material'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { listarEquipos } from '@/lib/db/equipos'
import { listarMiembros, listarMinisterios } from '@/lib/db/ministerios'
import { listarPrestamos, tieneEquipoACargo } from '@/lib/db/prestamos'
import { listarEventos, listarMisTurnos } from '@/lib/db/eventos'
import { formatearFecha, hoyISO } from '@/lib/fechas'
import { horaDeInstante } from '@/lib/servicio'
import { ETIQUETAS_CONSERVACION } from '@/types/domain'
import { inicialesDe } from '@/lib/nombres'
import AccionBaja from '@/components/AccionBaja'
import AccionDevolucion from '@/components/AccionDevolucion'
import AccionRecogida from '@/components/AccionRecogida'
import { chipDeFase, fasePrestamo } from '@/lib/prestamo'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioPrestamo from '@/components/FormularioPrestamo'
import NavegacionMinisterio from '@/components/NavegacionMinisterio'
import FiltroMinisterio from '@/components/FiltroMinisterio'
import { leerFiltroMinisterio, seccionesVisibles } from '@/lib/ministerio'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'
import { borrarPrestamo } from '@/features/ministerio/acciones'

export const instant = false
export const metadata = { title: 'Préstamos · Gosen' }

/**
 * Sala de préstamos: quién trae cada equipo, a quién se le asignó, a qué hora
 * salió y a qué hora (y cómo) volvió.
 *
 * Los préstamos abiertos van primero: son los que piden acción. El historial
 * se queda abajo, buscable con el mismo buscador.
 */
export default async function PaginaPrestamos({
  searchParams,
}: {
  searchParams: Promise<{ ministerio?: string }>
}) {
  const usuario = await exigirRol('ver', 'prestamo')
  const tieneEquipo = await tieneEquipoACargo(usuario.id)
  const filtroMinisterio = leerFiltroMinisterio((await searchParams).ministerio)

  const puedeVerEventos = rolPuede(usuario, 'ver', 'evento')
  const [todosLosPrestamos, todosLosEquipos, ministerios, misTurnos, eventosProximos] = await Promise.all([
    listarPrestamos(usuario, { soloAbiertos: false }),
    listarEquipos(usuario),
    listarMinisterios(usuario),
    listarMisTurnos(usuario.id),
    puedeVerEventos ? listarEventos(usuario, { desde: hoyISO() }) : Promise.resolve([]),
  ])

  // El filtro solo acota lo que el alcance ya dejó ver
  const prestamos = filtroMinisterio
    ? todosLosPrestamos.filter((prestamo) => prestamo.ministerioId === filtroMinisterio)
    : todosLosPrestamos
  const equipos = filtroMinisterio
    ? todosLosEquipos.filter((equipo) => equipo.ministerioId === filtroMinisterio)
    : todosLosEquipos
  const variosMinisterios = ministerios.length > 1

  const ministeriosPermitidos = ministerios.filter((ministerio) =>
    puede(usuario, 'crear', 'prestamo', { ministerioId: ministerio.id }),
  )
  // Solo integrantes del ministerio: el equipo es suyo y solo lo lleva alguien del equipo
  const cuentas = (
    await Promise.all(ministeriosPermitidos.map((ministerio) => listarMiembros(ministerio.id)))
  ).flat()
  const idsQuePrestan = new Set(ministeriosPermitidos.map((ministerio) => ministerio.id))

  // Se puede prestar lo que está en el inventario (no lo prestado ni la baja)
  const equiposPrestables = equipos
    .filter((equipo) => idsQuePrestan.has(equipo.ministerioId) && !equipo.prestado && equipo.estatus !== 'BAJA' && equipo.estatus !== 'MANTENIMIENTO')
    .map((equipo) => ({
      id: equipo.id,
      nombre: equipo.nombre,
      ministerio: equipo.nombreMinisterio,
      ministerioId: equipo.ministerioId,
    }))

  const filas: FilaListado[] = prestamos.map((prestamo) => {
    const abierto = prestamo.devueltoEn == null
    const fase = fasePrestamo(prestamo)
    // Lo que se ve en la fila: cómo salió y cómo volvió. Sin devolución anotada
    // no se inventa nada: solo «Devuelto».
    const recibido = prestamo.estadoDevolucion
    const editable = puede(usuario, 'editar', 'prestamo', { ministerioId: prestamo.ministerioId })

    return {
      id: prestamo.id,
      avatar: {
        texto: inicialesDe(prestamo.nombreEquipo ?? 'Equipo'),
        tono: abierto ? 'primary' : 'success',
      },
      celdas: [
        {
          clave: 'equipo',
          etiqueta: 'Equipo',
          texto: prestamo.nombreEquipo ?? `Equipo #${prestamo.equipoId}`,
          destacado: true,
        },
        {
          clave: 'evento',
          etiqueta: 'Evento',
          texto: prestamo.nombreEvento ?? 'Sin evento',
        },
        ...(variosMinisterios
          ? [{ clave: 'ministerio', etiqueta: 'Ministerio', texto: prestamo.nombreMinisterio ?? '—' }]
          : []),
        {
          clave: 'lleva',
          etiqueta: 'Lo lleva',
          // Quien lo recibe es quien responde por él (préstamos viejos pueden traer dos nombres)
          texto: prestamo.nombreAsignado ?? prestamo.nombreResponsable ?? '—',
        },
        {
          clave: 'salida',
          etiqueta: 'Salió',
          texto: `${formatearFecha(prestamo.prestadoEn)} · ${horaDeInstante(prestamo.prestadoEn) ?? ''}`,
          conEtiqueta: true,
        },
        {
          clave: 'regreso',
          etiqueta: 'Volvió',
          texto: prestamo.devueltoEn
            ? `${formatearFecha(prestamo.devueltoEn)} · ${horaDeInstante(prestamo.devueltoEn) ?? ''}`
            : 'Todavía no',
          conEtiqueta: true,
        },
        {
          clave: 'estado',
          etiqueta: 'Estado',
          texto:
            fase === 'POR_RECOGER'
              ? 'Por recoger: todavía no confirma que se lo llevó'
              : fase === 'POR_REVISAR'
                ? `Dice que lo devolvió ${prestamo.estadoDevolucionAvisado ? ETIQUETAS_CONSERVACION[prestamo.estadoDevolucionAvisado].toLowerCase() : ''}: falta recibirlo`
                : abierto
                  ? `Prestado · salió ${ETIQUETAS_CONSERVACION[prestamo.estadoEntrega].toLowerCase()}`
                  : recibido
                    ? `Devuelto · recibido ${ETIQUETAS_CONSERVACION[recibido].toLowerCase()}`
                    : 'Devuelto',
          // El chip es lo único del estado que se ve en la lista del teléfono, así
          // que lleva la fase (por recoger, prestado, por revisar, devuelto y cómo volvió).
          chip: chipDeFase(fase, recibido),
        },
        { clave: 'notas', etiqueta: 'Notas', texto: prestamo.notas ?? '—' },
      ],
      acciones: (
        <>
          {fase === 'POR_RECOGER' && editable ? (
            <AccionRecogida prestamoId={prestamo.id} equipo={prestamo.nombreEquipo ?? null} />
          ) : null}
          {(fase === 'PRESTADO' || fase === 'POR_REVISAR') && editable ? (
            <AccionDevolucion
              prestamoId={prestamo.id}
              equipo={prestamo.nombreEquipo ?? null}
              responsable={prestamo.nombreResponsable ?? null}
              estadoAvisado={prestamo.estadoDevolucionAvisado}
            />
          ) : null}
          {abierto && puede(usuario, 'eliminar', 'prestamo', { ministerioId: prestamo.ministerioId }) ? (
            <AccionBaja
              accion={borrarPrestamo}
              id={prestamo.id}
              queEs="el préstamo"
              mensajeExito="Préstamo cancelado"
            />
          ) : null}
        </>
      ),
    }
  })

  const abiertos = prestamos.filter((prestamo) => prestamo.devueltoEn == null).length

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Préstamos"
        etiqueta="Ministerio"
        icono={<SwapHorizIcon />}
        subtitulo={`${abiertos} ${abiertos === 1 ? 'equipo está fuera' : 'equipos están fuera'} ahora mismo. Cada quién puede traer varios equipos a la vez.`}
      />

      <NavegacionMinisterio
        secciones={seccionesVisibles(
          (recurso, accion) => rolPuede(usuario, accion, recurso),
          misTurnos.length > 0 || tieneEquipo,
        )}
        ministerioId={filtroMinisterio}
      />

      <FiltroMinisterio
        ministerios={ministerios.map((ministerio) => ({ id: ministerio.id, nombre: ministerio.nombre }))}
        actual={filtroMinisterio}
      />

      {ministeriosPermitidos.length > 0 ? (
        <FormularioPrestamo
          equipos={equiposPrestables}
          eventos={eventosProximos.map((evento) => ({
            id: evento.id,
            nombre: evento.nombre,
            fecha: evento.fecha,
            ministerioId: evento.ministerioId,
          }))}
          cuentas={cuentas}
        />
      ) : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={[
          'Equipo',
          'Evento',
          ...(variosMinisterios ? ['Ministerio'] : []),
          'Lo lleva',
          'Salió',
          'Volvió',
          'Estado',
          'Notas',
        ]}
        placeholderBuscador="Buscar por equipo, persona o nota…"
        accionesCabecera={puede(usuario, 'editar', 'prestamo')}
        mensajeVacio="No hay préstamos registrados. Usa «Nuevo préstamo» para que un equipo salga con alguien."
      />
    </Stack>
  )
}
