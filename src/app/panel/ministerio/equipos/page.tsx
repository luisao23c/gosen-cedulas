import { Stack } from '@mui/material'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede, type Recurso } from '@/lib/auth/permisos'
import { listarEquipos } from '@/lib/db/equipos'
import { listarMiembros, listarMinisterios } from '@/lib/db/ministerios'
import { listarPrestamos, tieneEquipoACargo } from '@/lib/db/prestamos'
import { listarEventos, listarMisTurnos } from '@/lib/db/eventos'
import { formatearFecha, hoyISO } from '@/lib/fechas'
import { horaDeInstante } from '@/lib/servicio'
import { ETIQUETAS_ESTATUS_EQUIPO, type EstatusEquipo } from '@/types/domain'
import { inicialesDe } from '@/lib/nombres'
import AccionBaja from '@/components/AccionBaja'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioEquipo from '@/components/FormularioEquipo'
import FormularioPrestamo from '@/components/FormularioPrestamo'
import NavegacionMinisterio from '@/components/NavegacionMinisterio'
import FiltroMinisterio from '@/components/FiltroMinisterio'
import { leerFiltroMinisterio, seccionesVisibles } from '@/lib/ministerio'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'
import { borrarEquipo } from '@/features/ministerio/acciones'

export const instant = false
export const metadata = { title: 'Equipos · Gosen' }

/** Tono del chip según el estatus del equipo. */
function tonoDeEstatus(estatus: EstatusEquipo): 'success' | 'primary' | 'warning' | 'default' {
  if (estatus === 'DISPONIBLE') return 'success'
  if (estatus === 'PRESTADO') return 'primary'
  if (estatus === 'MANTENIMIENTO') return 'warning'
  return 'default'
}

/**
 * Inventario del ministerio: qué hay, en qué estatus y quién trae cada equipo.
 * Desde aquí también se presta (el botón de la fila) y se registra que volvió.
 */
export default async function PaginaEquipos({
  searchParams,
}: {
  searchParams: Promise<{ ministerio?: string }>
}) {
  const usuario = await exigirRol('ver', 'equipo')
  const tieneEquipo = await tieneEquipoACargo(usuario.id)
  const filtroMinisterio = leerFiltroMinisterio((await searchParams).ministerio)
  const ve = (recurso: Recurso) => rolPuede(usuario, 'ver', recurso)

  const [ministerios, todosLosEquipos, prestamosAbiertos, misTurnos, eventosProximos] = await Promise.all([
    listarMinisterios(usuario),
    listarEquipos(usuario, { incluirBaja: true }),
    ve('prestamo') ? listarPrestamos(usuario) : Promise.resolve([]),
    listarMisTurnos(usuario.id),
    ve('prestamo') && ve('evento') ? listarEventos(usuario, { desde: hoyISO() }) : Promise.resolve([]),
  ])
  // El filtro solo acota lo que el alcance ya dejó ver
  const equipos = filtroMinisterio
    ? todosLosEquipos.filter((equipo) => equipo.ministerioId === filtroMinisterio)
    : todosLosEquipos
  const variosMinisterios = ministerios.length > 1
  const eventosLigables = eventosProximos.map((evento) => ({
    id: evento.id,
    nombre: evento.nombre,
    fecha: evento.fecha,
    ministerioId: evento.ministerioId,
  }))

  // Los equipos se crean dentro de un ministerio que la cuenta administre
  const ministeriosPermitidos = ministerios.filter((ministerio) =>
    puede(usuario, 'crear', 'equipo', { ministerioId: ministerio.id }),
  )
  // Prestar es del encargado del ministerio (y de la organización): se comprueba por ministerio
  const ministeriosQuePrestan = new Set(
    ve('prestamo')
      ? ministerios
          .filter((ministerio) => puede(usuario, 'crear', 'prestamo', { ministerioId: ministerio.id }))
          .map((ministerio) => ministerio.id)
      : [],
  )
  // Solo integrantes del ministerio: el equipo es suyo y solo lo lleva alguien del equipo
  const cuentas = (
    await Promise.all(Array.from(ministeriosQuePrestan).map((id) => listarMiembros(id)))
  ).flat()

  const abiertoPorEquipo = new Map(prestamosAbiertos.map((prestamo) => [prestamo.equipoId, prestamo]))

  const filas: FilaListado[] = equipos.map((equipo) => {
    const prestamo = abiertoPorEquipo.get(equipo.id)
    const editable = puede(usuario, 'editar', 'equipo', { ministerioId: equipo.ministerioId })
    const prestable =
      ministeriosQuePrestan.has(equipo.ministerioId) &&
      !equipo.prestado &&
      equipo.estatus !== 'BAJA' &&
      equipo.estatus !== 'MANTENIMIENTO'

    return {
      id: equipo.id,
      avatar: {
        texto: inicialesDe(equipo.nombre),
        tono:
          equipo.estatus === 'DISPONIBLE' ? 'success' : equipo.prestado ? 'primary' : 'default',
      },
      celdas: [
        { clave: 'nombre', etiqueta: 'Equipo', texto: equipo.nombre, destacado: true },
        // Con un solo ministerio la columna sobra: en el teléfono ensuciaba el subtítulo
        ...(variosMinisterios
          ? [{ clave: 'ministerio', etiqueta: 'Ministerio', texto: equipo.nombreMinisterio ?? '—' }]
          : []),
        {
          clave: 'trae',
          etiqueta: 'Quién lo trae',
          texto: prestamo?.nombreResponsable ?? 'Nadie: está en el inventario',
        },
        {
          clave: 'salida',
          etiqueta: 'Salió',
          texto: prestamo
            ? `${formatearFecha(prestamo.prestadoEn)} · ${horaDeInstante(prestamo.prestadoEn) ?? ''}`
            : '—',
        },
        {
          clave: 'estatus',
          etiqueta: 'Estatus',
          texto: ETIQUETAS_ESTATUS_EQUIPO[equipo.estatus],
          chip: {
            etiqueta: ETIQUETAS_ESTATUS_EQUIPO[equipo.estatus],
            tono: tonoDeEstatus(equipo.estatus),
          },
        },
        { clave: 'descripcion', etiqueta: 'Descripción', texto: equipo.descripcion ?? '—' },
      ],
      acciones: (
        <>
          {prestable ? (
            <FormularioPrestamo
              equipos={[
                {
                  id: equipo.id,
                  nombre: equipo.nombre,
                  ministerio: equipo.nombreMinisterio,
                  ministerioId: equipo.ministerioId,
                },
              ]}
              cuentas={cuentas}
              eventos={eventosLigables}
              equipoIdInicial={equipo.id}
              comoIcono
            />
          ) : null}
          {editable ? (
            <FormularioEquipo
              accion="editar"
              inicial={{
                id: equipo.id,
                nombre: equipo.nombre,
                descripcion: equipo.descripcion,
                estatus: equipo.estatus,
              }}
            />
          ) : null}
          {equipo.estatus !== 'BAJA' && puede(usuario, 'eliminar', 'equipo', { ministerioId: equipo.ministerioId }) ? (
            <AccionBaja
              accion={borrarEquipo}
              id={equipo.id}
              queEs="el equipo"
              mensajeExito="Equipo dado de baja"
            />
          ) : null}
        </>
      ),
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Equipos"
        etiqueta="Ministerio"
        icono={<Inventory2Icon />}
        subtitulo={`${equipos.length} ${equipos.length === 1 ? 'equipo' : 'equipos'} en el inventario. Los prestados siguen contando aquí hasta que vuelvan.`}
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
        <FormularioEquipo
          accion="crear"
          ministerioId={
            ministeriosPermitidos.length === 1
              ? ministeriosPermitidos[0].id
              : ministeriosPermitidos.some((ministerio) => ministerio.id === filtroMinisterio)
                ? (filtroMinisterio ?? undefined)
                : undefined
          }
          ministerios={ministeriosPermitidos.map((ministerio) => ({
            id: ministerio.id,
            nombre: ministerio.nombre,
          }))}
        />
      ) : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={[
          'Equipo',
          ...(variosMinisterios ? ['Ministerio'] : []),
          'Quién lo trae',
          'Salió',
          'Estatus',
          'Descripción',
        ]}
        placeholderBuscador="Buscar equipo, quién lo trae o su descripción…"
        accionesCabecera={puede(usuario, 'editar', 'equipo')}
        mensajeVacio={
          ministeriosPermitidos.length > 0
            ? 'El inventario está vacío. Agrega el primer equipo con el botón «Nuevo equipo».'
            : 'No hay equipos a tu alcance.'
        }
      />
    </Stack>
  )
}
