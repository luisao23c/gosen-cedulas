import { Stack } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede, type Recurso } from '@/lib/auth/permisos'
import { listarEquipos } from '@/lib/db/equipos'
import { listarMinisterios } from '@/lib/db/ministerios'
import { listarPrestamos } from '@/lib/db/prestamos'
import { listarAsignables, listarMisTurnos } from '@/lib/db/eventos'
import { formatearFecha } from '@/lib/fechas'
import { horaDeInstante } from '@/lib/servicio'
import { ETIQUETAS_ESTATUS_EQUIPO, type EstatusEquipo } from '@/types/domain'
import { inicialesDe } from '@/lib/nombres'
import AccionBaja from '@/components/AccionBaja'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioEquipo from '@/components/FormularioEquipo'
import FormularioPrestamo from '@/components/FormularioPrestamo'
import NavegacionMinisterio from '@/components/NavegacionMinisterio'
import { seccionesVisibles } from '@/lib/ministerio'
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
export default async function PaginaEquipos() {
  const usuario = await exigirRol('ver', 'equipo')
  const ve = (recurso: Recurso) => rolPuede(usuario, 'ver', recurso)

  const [ministerios, equipos, prestamosAbiertos, misTurnos] = await Promise.all([
    listarMinisterios(usuario),
    listarEquipos(usuario, { incluirBaja: true }),
    ve('prestamo') ? listarPrestamos(usuario) : Promise.resolve([]),
    listarMisTurnos(usuario.id),
  ])

  // Los equipos se crean dentro de un ministerio que la cuenta administre
  const ministeriosPermitidos = ministerios.filter((ministerio) =>
    puede(usuario, 'crear', 'equipo', { ministerioId: ministerio.id }),
  )
  const puedePrestar = ve('prestamo') && puede(usuario, 'crear', 'prestamo')
  const cuentas = puedePrestar
    ? await Promise.all(
        ministeriosPermitidos.map((ministerio) => listarAsignables(ministerio.id)),
      ).then((listas) => {
        const porId = new Map(listas.flat().map((cuenta) => [cuenta.id, cuenta]))
        return Array.from(porId.values())
      })
    : []

  const abiertoPorEquipo = new Map(prestamosAbiertos.map((prestamo) => [prestamo.equipoId, prestamo]))

  const filas: FilaListado[] = equipos.map((equipo) => {
    const prestamo = abiertoPorEquipo.get(equipo.id)
    const editable = puede(usuario, 'editar', 'equipo', { ministerioId: equipo.ministerioId })
    const prestable =
      puedePrestar && !equipo.prestado && equipo.estatus !== 'BAJA' && equipo.estatus !== 'MANTENIMIENTO'

    return {
      id: equipo.id,
      avatar: {
        texto: inicialesDe(equipo.nombre),
        tono:
          equipo.estatus === 'DISPONIBLE' ? 'success' : equipo.prestado ? 'primary' : 'default',
      },
      celdas: [
        { clave: 'nombre', etiqueta: 'Equipo', texto: equipo.nombre, destacado: true },
        {
          clave: 'ministerio',
          etiqueta: 'Ministerio',
          texto: equipo.nombreMinisterio ?? '—',
        },
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
              equipos={[{ id: equipo.id, nombre: equipo.nombre, ministerio: equipo.nombreMinisterio }]}
              cuentas={cuentas}
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
        icono={<VideocamIcon />}
        subtitulo={`${equipos.length} ${equipos.length === 1 ? 'equipo' : 'equipos'} en el inventario. Los prestados siguen contando aquí hasta que vuelvan.`}
      />

      <NavegacionMinisterio
        secciones={seccionesVisibles(
          (recurso, accion) => rolPuede(usuario, accion, recurso),
          misTurnos.length > 0,
        )}
      />

      {ministeriosPermitidos.length > 0 ? (
        <FormularioEquipo
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
        etiquetas={['Equipo', 'Ministerio', 'Quién lo trae', 'Salió', 'Estatus', 'Descripción']}
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
