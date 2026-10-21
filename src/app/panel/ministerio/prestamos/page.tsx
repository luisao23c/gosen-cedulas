import { Stack } from '@mui/material'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { listarEquipos } from '@/lib/db/equipos'
import { listarMinisterios } from '@/lib/db/ministerios'
import { listarPrestamos } from '@/lib/db/prestamos'
import { listarAsignables, listarMisTurnos } from '@/lib/db/eventos'
import { formatearFecha } from '@/lib/fechas'
import { horaDeInstante } from '@/lib/servicio'
import { ETIQUETAS_CONSERVACION } from '@/types/domain'
import { inicialesDe } from '@/lib/nombres'
import AccionBaja from '@/components/AccionBaja'
import AccionDevolucion from '@/components/AccionDevolucion'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioPrestamo from '@/components/FormularioPrestamo'
import NavegacionMinisterio from '@/components/NavegacionMinisterio'
import { seccionesVisibles } from '@/lib/ministerio'
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
export default async function PaginaPrestamos() {
  const usuario = await exigirRol('ver', 'prestamo')

  const [prestamos, equipos, ministerios, misTurnos] = await Promise.all([
    listarPrestamos(usuario, { soloAbiertos: false }),
    listarEquipos(usuario),
    listarMinisterios(usuario),
    listarMisTurnos(usuario.id),
  ])

  const ministeriosPermitidos = ministerios.filter((ministerio) =>
    puede(usuario, 'crear', 'prestamo', { ministerioId: ministerio.id }),
  )
  const cuentas = await Promise.all(
    ministeriosPermitidos.map((ministerio) => listarAsignables(ministerio.id)),
  ).then((listas) => {
    const porId = new Map(listas.flat().map((cuenta) => [cuenta.id, cuenta]))
    return Array.from(porId.values())
  })

  // Se puede prestar lo que está en el inventario (no lo prestado ni la baja)
  const equiposPrestables = equipos
    .filter((equipo) => !equipo.prestado && equipo.estatus !== 'BAJA' && equipo.estatus !== 'MANTENIMIENTO')
    .map((equipo) => ({
      id: equipo.id,
      nombre: equipo.nombre,
      ministerio: equipo.nombreMinisterio,
    }))

  const filas: FilaListado[] = prestamos.map((prestamo) => {
    const abierto = prestamo.devueltoEn == null
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
          clave: 'trae',
          etiqueta: 'Lo trae',
          texto: prestamo.nombreResponsable ?? '—',
        },
        {
          clave: 'asignado',
          etiqueta: 'Asignado a',
          texto: prestamo.nombreAsignado ?? 'Sin asignar',
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
          texto: abierto
            ? `Prestado · salió ${ETIQUETAS_CONSERVACION[prestamo.estadoEntrega].toLowerCase()}`
            : recibido
              ? `Devuelto · recibido ${ETIQUETAS_CONSERVACION[recibido].toLowerCase()}`
              : 'Devuelto',
          // El chip es lo único del estado que se ve en la lista del teléfono, así
          // que lleva el cómo volvió: «Devuelto · con algún detalle» avisa sin abrir nada.
          chip: {
            etiqueta: abierto
              ? 'Prestado'
              : recibido
                ? `Devuelto · ${ETIQUETAS_CONSERVACION[recibido].toLowerCase()}`
                : 'Devuelto',
            tono: abierto
              ? 'primary'
              : recibido && recibido !== 'BUENO'
                ? 'warning'
                : 'success',
          },
        },
        { clave: 'notas', etiqueta: 'Notas', texto: prestamo.notas ?? '—' },
      ],
      acciones: (
        <>
          {abierto && editable ? (
            <AccionDevolucion
              prestamoId={prestamo.id}
              equipo={prestamo.nombreEquipo ?? null}
              responsable={prestamo.nombreResponsable ?? null}
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
          misTurnos.length > 0,
        )}
      />

      {ministeriosPermitidos.length > 0 ? (
        <FormularioPrestamo
          equipos={equiposPrestables}
          cuentas={cuentas.map((cuenta) => ({
            id: cuenta.id,
            nombre: cuenta.nombre,
            email: cuenta.email,
            rolNombre: cuenta.rolNombre,
            alcance: cuenta.alcance,
          }))}
        />
      ) : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Equipo', 'Lo trae', 'Asignado a', 'Salió', 'Volvió', 'Estado', 'Notas']}
        placeholderBuscador="Buscar por equipo, persona o nota…"
        accionesCabecera={puede(usuario, 'editar', 'prestamo')}
        mensajeVacio="No hay préstamos registrados. Usa «Nuevo préstamo» para que un equipo salga con alguien."
      />
    </Stack>
  )
}
