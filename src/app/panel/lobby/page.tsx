import { Stack } from '@mui/material'
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircleOutlined'
import { exigirRol } from '@/lib/auth/guardas'
import { listarCelulas } from '@/lib/db/celulas'
import { listarRamas } from '@/lib/db/ramas'
import { listarCampos, listarCriteriosDeCelulas } from '@/lib/db/campos'
import { formatearHora } from '@/lib/fechas'
import { DIAS_SEMANA } from '@/types/domain'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import RegistroLobby, { type CelulaCercana } from '@/features/lobby/RegistroLobby'

export const instant = false
export const metadata = { title: 'Registrar por ubicación · Gosen' }

/**
 * Lobby: registrar a una persona nueva dejando que su ubicación y sus
 * respuestas decidan.
 *
 * Se marca dónde vive en el mapa, se contestan los campos del catálogo
 * («Estado civil», «Edad»…) y la pantalla ordena las células por cercanía y por
 * qué tan bien cumplen lo que cada una declaró aceptar. Quien registra elige:
 * la recomendación sugiere, nunca inscribe sola.
 *
 * El alcance del rol se aplica en el SQL del listado: nadie ve células que no
 * le correspondan.
 */
export default async function PaginaLobby() {
  const usuario = await exigirRol('crear', 'integrante')

  const [celulas, ramas, campos] = await Promise.all([
    listarCelulas(usuario, { soloActivas: true }),
    listarRamas(usuario),
    listarCampos(true),
  ])

  // Los criterios de todas las candidatas, de una sola consulta
  const criteriosPorCelula = await listarCriteriosDeCelulas(celulas.map((celula) => celula.id))

  const nombreDeRama = new Map(ramas.map((rama) => [rama.id, rama.nombre]))

  const opciones: CelulaCercana[] = celulas.map((celula) => ({
    id: celula.id,
    nombre: celula.nombre,
    rama: nombreDeRama.get(celula.ramaId) ?? `Rama #${celula.ramaId}`,
    reunion:
      celula.diaSemana != null
        ? `${DIAS_SEMANA[celula.diaSemana]}${celula.hora ? ` · ${formatearHora(celula.hora)}` : ''}`
        : 'Sin día fijo',
    latitud: celula.ubicacion.latitud,
    longitud: celula.ubicacion.longitud,
    direccion: celula.ubicacion.direccion,
    criterios: criteriosPorCelula.get(celula.id) ?? [],
  }))

  const conUbicacion = opciones.filter((celula) => celula.latitud != null).length
  const conCriterios = opciones.filter((celula) => celula.criterios.length > 0).length

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Registrar por ubicación"
        etiqueta="Lobby"
        icono={<PersonPinCircleIcon />}
        subtitulo={
          opciones.length === 0
            ? 'Todavía no hay células activas a tu alcance.'
            : `${opciones.length} ${opciones.length === 1 ? 'célula disponible' : 'células disponibles'} · ${conUbicacion} con ubicación en el mapa · ${conCriterios} con criterios declarados. Marca dónde vive la persona, contesta lo que sepas y elige la que mejor le sirve.`
        }
      />

      <RegistroLobby celulas={opciones} campos={campos} />
    </Stack>
  )
}
