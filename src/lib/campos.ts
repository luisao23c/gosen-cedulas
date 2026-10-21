import type {
  CampoDiferenciador,
  CriterioCelula,
  EvaluacionCelula,
  PuntajeCandidata,
  RespuestaCampo,
} from '@/types/domain'

/**
 * Reglas de los campos diferenciadores, sin base de datos ni React.
 *
 * El mismo módulo lo usan el servidor (para leer y guardar) y el registro por
 * ubicación (para ordenar las candidatas mientras se responden los campos).
 *
 * Regla de juego:
 *  · un criterio **obligatorio** que no se cumple descarta a la candidata;
 *  · las **preferencias** cumplidas suman al puntaje;
 *  · lo que no se pudo comprobar (sin respuesta) cuenta como no cumplido.
 *
 * La cercanía sigue mandando para el desempate: los criterios filtran y
 * ordenan, el mapa decide entre iguales.
 */

/** Índice rápido de campos por id. */
export function porIdCampos(campos: CampoDiferenciador[]): Map<number, CampoDiferenciador> {
  return new Map(campos.map((campo) => [campo.id, campo]))
}

/** Índice rápido de respuestas por campo. */
export function porIdRespuestas(respuestas: RespuestaCampo[]): Map<number, RespuestaCampo> {
  return new Map(respuestas.map((respuesta) => [respuesta.campoId, respuesta]))
}

/** Nombre de una opción elegida, o null si ya no existe en el catálogo. */
export function etiquetaDeOpcion(
  campo: CampoDiferenciador | undefined,
  opcionId: number | null | undefined,
): string | null {
  if (!campo || opcionId == null) return null
  return campo.opciones.find((opcion) => opcion.id === opcionId)?.etiqueta ?? null
}

/** «entre 18 y 25 años» · «más de 30 años» · «hasta 25 años» — lo que acepta una célula. */
export function etiquetaDeRango(campo: CampoDiferenciador, criterio: CriterioCelula): string {
  const unidad = campo.unidad ? ` ${campo.unidad}` : ''
  if (criterio.minimo != null && criterio.maximo != null) {
    return `entre ${criterio.minimo} y ${criterio.maximo}${unidad}`
  }
  if (criterio.minimo != null) return `más de ${criterio.minimo}${unidad}`
  if (criterio.maximo != null) return `hasta ${criterio.maximo}${unidad}`
  return 'cualquier valor'
}

/** Qué acepta una célula en un campo, en texto (para el motivo de la recomendación). */
export function queAcepta(campo: CampoDiferenciador, criterio: CriterioCelula): string {
  if (criterio.opcionIds.length === 0) return 'sin opciones marcadas'
  const etiquetas = criterio.opcionIds
    .map((opcionId) => etiquetaDeOpcion(campo, opcionId))
    .filter((etiqueta): etiqueta is string => etiqueta != null)
  return etiquetas.length > 0 ? etiquetas.join(' · ') : 'sin opciones marcadas'
}

/** ¿El valor de un campo RANGO cae dentro del criterio? */
function valorEnRango(criterio: CriterioCelula, valor: number): boolean {
  if (criterio.minimo != null && valor < criterio.minimo) return false
  if (criterio.maximo != null && valor > criterio.maximo) return false
  return true
}

/**
 * Compara los criterios de una candidata contra lo que respondió la persona.
 * Un campo del criterio que ya no existe en el catálogo se ignora: no puede
 * juzgarse algo que ya no está preguntado.
 */
export function evaluarCandidata(
  criterios: CriterioCelula[],
  campos: Map<number, CampoDiferenciador>,
  respuestas: Map<number, RespuestaCampo>,
): EvaluacionCelula {
  const obligatorios = { cumplidos: 0, total: 0 }
  const preferencias = { cumplidos: 0, total: 0 }
  const cumplidos: string[] = []
  const faltantes: string[] = []
  const faltantesObligatorios: string[] = []
  let apta = true

  for (const criterio of criterios) {
    const campo = campos.get(criterio.campoId)
    if (!campo) continue
    const respuesta = respuestas.get(criterio.campoId)
    const esObligatorio = criterio.obligatorio

    let cumple = false
    if (campo.tipo === 'SELECT') {
      const elegida = respuesta?.opcionId ?? null
      cumple = elegida != null && criterio.opcionIds.includes(elegida)
    } else {
      const valor = respuesta?.valor ?? null
      cumple = valor != null && valorEnRango(criterio, valor)
    }

    if (esObligatorio) obligatorios.total += 1
    else preferencias.total += 1

    if (cumple) {
      if (esObligatorio) obligatorios.cumplidos += 1
      else preferencias.cumplidos += 1
      const detalle =
        campo.tipo === 'SELECT'
          ? etiquetaDeOpcion(campo, respuesta?.opcionId ?? null)
          : `${respuesta?.valor}${campo.unidad ? ` ${campo.unidad}` : ''}`
      cumplidos.push(`${campo.nombre}${detalle ? `: ${detalle}` : ''}`)
    } else {
      if (esObligatorio) apta = false
      const queBusca =
        campo.tipo === 'SELECT' ? queAcepta(campo, criterio) : etiquetaDeRango(campo, criterio)
      const motivo = `${campo.nombre} (${queBusca})`
      faltantes.push(motivo)
      if (esObligatorio) faltantesObligatorios.push(motivo)
    }
  }

  return {
    celulaId: criterios[0]?.celulaId ?? 0,
    apta,
    obligatorios,
    preferencias,
    cumplidos,
    faltantes,
    faltantesObligatorios,
  }
}

/** Resumen corto para el chip de la recomendación («Cumple 2 de 2 · +1 preferencia»). */
export function resumenDeEvaluacion(evaluacion: EvaluacionCelula | undefined): string | null {
  if (!evaluacion) return null
  const piezas: string[] = []
  if (evaluacion.obligatorios.total > 0) {
    piezas.push(`Cumple ${evaluacion.obligatorios.cumplidos} de ${evaluacion.obligatorios.total}`)
  }
  if (evaluacion.preferencias.cumplidos > 0) {
    piezas.push(
      `${evaluacion.preferencias.cumplidos} ${evaluacion.preferencias.cumplidos === 1 ? 'preferencia' : 'preferencias'}`,
    )
  }
  return piezas.length > 0 ? piezas.join(' · ') : null
}

/** Peso de cada parte en el puntaje: criterios 70 %, cercanía 30 %. */
const PESO_CRITERIOS = 0.7
const PESO_CERCANIA = 0.3
/** A esta distancia (km) la cercanía vale 0: más lejos que esto ya no suma. */
const KM_SIN_CERCANIA = 15

/**
 * Puntaje de 0 a 100 con el que se ordena el ranking del Lobby.
 *
 *  · Criterios: lo cumplido sobre lo declarado; los obligatorios pesan el doble
 *    que las preferencias. Si la persona no ha contestado nada, o la célula no
 *    declaró criterios, esa parte queda neutra (0.5): no premia ni castiga.
 *  · Cercanía: baja en línea recta de 1 (misma esquina) a 0 (a 15 km o más).
 *    Sin punto en el mapa no se mide y todo el puntaje sale de los criterios.
 *
 * Así una célula que cumple más y queda más cerca sube; una que cumple todo pero
 * está al otro lado de la ciudad puede quedar debajo de una algo menos exacta pero
 * muy cercana. Las que fallan un obligatorio se ordenan aparte (ver ordenarCandidatas).
 */
export function puntuarCandidata(
  evaluacion: EvaluacionCelula | undefined,
  distanciaKm: number | null,
  hayRespuestas: boolean,
): PuntajeCandidata {
  let porCriterios = 0.5
  if (evaluacion && hayRespuestas) {
    const total = evaluacion.obligatorios.total * 2 + evaluacion.preferencias.total
    const logrado = evaluacion.obligatorios.cumplidos * 2 + evaluacion.preferencias.cumplidos
    porCriterios = total > 0 ? logrado / total : 0.5
  }
  const porCercania =
    distanciaKm == null ? null : Math.max(0, 1 - distanciaKm / KM_SIN_CERCANIA)
  const mezcla =
    porCercania == null
      ? porCriterios
      : porCriterios * PESO_CRITERIOS + porCercania * PESO_CERCANIA
  return { puntaje: Math.round(mezcla * 100), porCriterios, porCercania }
}

/**
 * Orden del ranking: primero las que cumplen todo lo obligatorio, y dentro de cada
 * grupo la de mayor puntaje; a igualdad, la más cercana.
 */
export function compararCandidatas(
  a: { evaluacion?: EvaluacionCelula; puntaje: PuntajeCandidata; distancia: number | null },
  b: { evaluacion?: EvaluacionCelula; puntaje: PuntajeCandidata; distancia: number | null },
  hayRespuestas: boolean,
): number {
  if (hayRespuestas) {
    const aptaA = a.evaluacion ? (a.evaluacion.apta ? 1 : 0) : 1
    const aptaB = b.evaluacion ? (b.evaluacion.apta ? 1 : 0) : 1
    if (aptaA !== aptaB) return aptaB - aptaA
  }
  if (a.puntaje.puntaje !== b.puntaje.puntaje) return b.puntaje.puntaje - a.puntaje.puntaje
  return (a.distancia ?? Number.POSITIVE_INFINITY) - (b.distancia ?? Number.POSITIVE_INFINITY)
}
