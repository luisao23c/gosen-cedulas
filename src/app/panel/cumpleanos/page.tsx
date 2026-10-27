import { Stack, Typography } from '@mui/material'
import CakeIcon from '@mui/icons-material/CakeOutlined'
import { exigirRol } from '@/lib/auth/guardas'
import { listarConFechaNacimiento } from '@/lib/db/integrantes'
import { listarRamas } from '@/lib/db/ramas'
import { cumpleanosProximos, etiquetaFaltan, ventanaPedida } from '@/lib/cumpleanos'
import { formatearFechaConDia } from '@/lib/fechas'
import { inicialesDe } from '@/lib/nombres'
import { ETIQUETAS_SITUACION, nombreCompleto } from '@/types/domain'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FiltrosCumpleanos from '@/components/FiltrosCumpleanos'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Cumpleaños · Gosen' }

/**
 * Cumpleaños próximos: quién cumple años dentro de la ventana elegida,
 * agrupado por célula y ordenado por cercanía del día.
 *
 * La ventana vive en la URL (`?dias=30`) y el cálculo lo hace el servidor con
 * `lib/cumpleanos.ts`. El alcance del rol lo aplica el SQL del listado, así que
 * un líder de célula solo ve a los suyos.
 */
export default async function PaginaCumpleanos({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>
}) {
  const { dias } = await searchParams
  const ventana = ventanaPedida(dias)

  const usuario = await exigirRol('ver', 'integrante')
  const [integrantes, ramas] = await Promise.all([
    listarConFechaNacimiento(usuario),
    listarRamas(usuario),
  ])
  const nombreDeRama = new Map(ramas.map((rama) => [rama.id, rama.nombre]))

  const proximos = cumpleanosProximos(integrantes, ventana)
  const hoy = proximos.filter(({ cumple }) => cumple.dias === 0).length

  const filas: FilaListado[] = proximos.map(({ persona, cumple }) => {
    const rama = persona.ramaId != null ? nombreDeRama.get(persona.ramaId) : null
    const cumpleHoy = cumple.dias === 0
    return {
      id: persona.id,
      href: `/panel/celulas/${persona.celulaId}`,
      // Agrupación: la célula (con su rama, porque dos ramas pueden repetir nombre)
      grupo: `${persona.nombreCelula ?? `Célula #${persona.celulaId}`} · ${rama ?? 'Sin rama'}`,
      avatar: {
        texto: inicialesDe(nombreCompleto(persona)),
        tono: cumpleHoy ? 'success' : 'primary',
      },
      celdas: [
        {
          clave: 'nombre',
          etiqueta: 'Cumpleañero',
          texto: nombreCompleto(persona),
          destacado: true,
        },
        { clave: 'fecha', etiqueta: 'Cumple el', texto: formatearFechaConDia(cumple.fecha) },
        { clave: 'edad', etiqueta: 'Cumple', texto: `${cumple.edad} años` },
        {
          clave: 'situacion',
          etiqueta: 'Situación',
          texto: ETIQUETAS_SITUACION[persona.situacion],
          chip:
            persona.situacion === 'ACTIVO'
              ? undefined
              : { etiqueta: ETIQUETAS_SITUACION[persona.situacion], tono: 'primary' },
        },
        { clave: 'telefono', etiqueta: 'Teléfono', texto: persona.telefono ?? '—' },
        {
          clave: 'faltan',
          etiqueta: 'Faltan',
          texto: etiquetaFaltan(cumple.dias),
          chip: {
            etiqueta: etiquetaFaltan(cumple.dias),
            tono: cumpleHoy ? 'success' : cumple.dias <= 7 ? 'primary' : 'default',
          },
        },
      ],
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Cumpleaños"
        etiqueta="Personas"
        icono={<CakeIcon />}
        subtitulo={
          integrantes.length === 0
            ? 'Todavía no hay integrantes con fecha de nacimiento a tu alcance. Se captura en la ficha del integrante.'
            : proximos.length === 0
              ? `Nadie cumple años en los próximos ${ventana} días.`
              : `${proximos.length} ${proximos.length === 1 ? 'cumpleaños' : 'cumpleaños'} en los próximos ${ventana} días${hoy > 0 ? ` · ${hoy} hoy` : ''}.`
        }
      />

      <FiltrosCumpleanos />

      <Typography variant="caption" color="text.secondary">
        Se cuentan los integrantes activos y visitantes con fecha de nacimiento; los inactivos y
        egresados no entran. Toca una fila para abrir su célula.
      </Typography>

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Cumpleañero', 'Cumple el', 'Cumple', 'Situación', 'Teléfono', 'Faltan']}
        placeholderBuscador="Buscar por nombre, célula, teléfono o día…"
        iconoVacio={<CakeIcon />}
        mensajeVacio={
          integrantes.length === 0
            ? 'Aún no hay fechas de nacimiento que revisar. Agrega la fecha al registrar o editar un integrante y aparecerá aquí.'
            : `Nadie cumple años en los próximos ${ventana} días. Prueba con una ventana más amplia.`
        }
      />
    </Stack>
  )
}
