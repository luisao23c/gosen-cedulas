/**
 * Geografía.
 *
 * Utilidades puras (sin React y sin acceso a datos) para ubicar células y
 * personas: distancias, formato de coordenadas y la dirección que se obtiene
 * al marcar un punto en el mapa.
 *
 * La geocodificación inversa usa Nominatim (OpenStreetMap): es gratuita, no
 * necesita clave y responde con los datos del punto marcado. Si falla, las
 * coordenadas siguen siendo válidas: la dirección es un extra, no un requisito.
 */

/** Punto en el planeta. */
export interface Coordenadas {
  latitud: number
  longitud: number
}

/** Dirección obtenida de un punto (todas las piezas son opcionales). */
export interface DireccionResuelta {
  /** Dirección legible: «Av. Morelos 100, Centro, Torreón, Coahuila» */
  direccion: string | null
  calle: string | null
  colonia: string | null
  ciudad: string | null
  estado: string | null
  cp: string | null
  pais: string | null
}

/** Punto de una ubicación guardada, o null si le falta alguna coordenada. */
export function coordenadasDe(ubicacion: {
  latitud: number | null
  longitud: number | null
}): Coordenadas | null {
  const { latitud, longitud } = ubicacion
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null
  return { latitud: latitud as number, longitud: longitud as number }
}

const RADIO_TIERRA_KM = 6371.0088
const DIRECCION_VACIA: DireccionResuelta = {
  direccion: null,
  calle: null,
  colonia: null,
  ciudad: null,
  estado: null,
  cp: null,
  pais: null,
}

const aRadianes = (grados: number): number => (grados * Math.PI) / 180

/**
 * Distancia en kilómetros entre dos puntos (fórmula del semiverseno).
 * Sirve para ordenar las células por cercanía a donde vive una persona.
 */
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const diferenciaLatitud = aRadianes(b.latitud - a.latitud)
  const diferenciaLongitud = aRadianes(b.longitud - a.longitud)
  const h =
    Math.sin(diferenciaLatitud / 2) ** 2 +
    Math.cos(aRadianes(a.latitud)) *
      Math.cos(aRadianes(b.latitud)) *
      Math.sin(diferenciaLongitud / 2) ** 2
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Distancia ya formateada: «850 m», «1,4 km», «12 km». */
export function distanciaLegible(km: number): string {
  if (km < 1) {
    const metros = Math.max(10, Math.round((km * 1000) / 10) * 10)
    return `${metros} m`
  }
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`
  return `${Math.round(km)} km`
}

/** Coordenadas con cinco decimales (precisión de un metro, sin ruido). */
export function formatearCoordenadas(latitud: number, longitud: number): string {
  return `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`
}

/** Redondea lo que se guarda: cinco decimales bastan y evitan ruido en la base. */
export function redondearCoordenada(valor: number): number {
  return Number(valor.toFixed(5))
}

/** Enlace para abrir el punto en el mapa público de OpenStreetMap. */
export function enlaceMapa(latitud: number, longitud: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitud}&mlon=${longitud}#map=17/${latitud}/${longitud}`
}

/** Un lugar encontrado al buscar por código postal, colonia o dirección. */
export interface LugarEncontrado {
  /** Texto corto para mostrar en la lista: «Centro, Torreón, Coahuila, 27000» */
  etiqueta: string
  latitud: number
  longitud: number
}

/**
 * Busca lugares por código postal, colonia o dirección (Nominatim).
 *
 *  · Cinco dígitos solos se tratan como CÓDIGO POSTAL (búsqueda estructurada, mucho
 *    más precisa que el texto libre).
 *  · Cualquier otro texto es una búsqueda libre («Col. Centro Torreón»).
 *  · Siempre se limita al país de `mapa.pais` y se prefiere el entorno de `centro`
 *    (la ciudad donde trabaja la iglesia), así «Centro» no devuelve otra ciudad.
 *
 * Nunca lanza: sin conexión o sin resultados devuelve una lista vacía y quien llama
 * decide qué decirle a la persona. Los resultados son una SUGERENCIA: quien registra
 * puede mover el punto después tocando el mapa.
 */
export async function buscarLugares(
  texto: string,
  opciones: {
    pais: string
    centro: Coordenadas
    senal?: AbortSignal
  },
): Promise<LugarEncontrado[]> {
  const consulta = texto.trim()
  if (consulta.length < 3) return []

  const margen = 0.6 // ≈ 65 km alrededor del centro: preferencia, no frontera
  const parametros = new URLSearchParams({
    format: 'jsonv2',
    limit: '6',
    addressdetails: '1',
    countrycodes: opciones.pais,
    'accept-language': 'es',
    viewbox: [
      opciones.centro.longitud - margen,
      opciones.centro.latitud + margen,
      opciones.centro.longitud + margen,
      opciones.centro.latitud - margen,
    ].join(','),
    bounded: '0',
  })
  if (/^\d{5}$/.test(consulta)) parametros.set('postalcode', consulta)
  else parametros.set('q', consulta)

  try {
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${parametros}`, {
      signal: opciones.senal ?? AbortSignal.timeout(9000),
      headers: { Accept: 'application/json' },
    })
    if (!respuesta.ok) return []

    const datos = (await respuesta.json()) as Array<{
      lat?: string
      lon?: string
      display_name?: string
      address?: Record<string, unknown>
    }>
    if (!Array.isArray(datos)) return []

    const vistos = new Set<string>()
    const lugares: LugarEncontrado[] = []
    for (const dato of datos) {
      const latitud = Number(dato.lat)
      const longitud = Number(dato.lon)
      if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) continue

      const direccion = dato.address
      const etiqueta =
        direccion && typeof direccion === 'object'
          ? componerDireccion({
              calle: primero(direccion, ['road', 'pedestrian']),
              colonia: primero(direccion, ['neighbourhood', 'suburb', 'quarter', 'city_district']),
              ciudad: primero(direccion, ['city', 'town', 'village', 'municipality', 'county']),
              estado: primero(direccion, ['state', 'region']),
              cp: primero(direccion, ['postcode']),
              pais: primero(direccion, ['country']),
              direccion: null,
            })
          : null
      const texto = etiqueta ?? (dato.display_name ?? '').split(', ').slice(0, 4).join(', ')
      if (!texto || vistos.has(texto)) continue
      vistos.add(texto)
      lugares.push({
        etiqueta: texto,
        latitud: redondearCoordenada(latitud),
        longitud: redondearCoordenada(longitud),
      })
    }
    return lugares
  } catch {
    return []
  }
}

/** Primer valor con contenido de una lista de claves del geocodificador. */
function primero(direccion: Record<string, unknown>, claves: string[]): string | null {
  for (const clave of claves) {
    const valor = direccion[clave]
    if (typeof valor === 'string' && valor.trim() !== '') return valor.trim()
  }
  return null
}

/** Arma la dirección legible con las piezas que sí vinieron. */
function componerDireccion(piezas: DireccionResuelta): string | null {
  const via = [piezas.calle].filter(Boolean).join(' ')
  const partes = [via, piezas.colonia, piezas.ciudad, piezas.estado, piezas.cp].filter(
    (parte): parte is string => Boolean(parte),
  )
  if (partes.length > 0) return partes.join(', ')
  return piezas.pais
}

/**
 * Dirección aproximada de un punto (Nominatim, OpenStreetMap).
 * Nunca lanza: si el servicio no responde, devuelve todo en null y quien llama
 * decide cómo avisarlo.
 */
export async function resolverDireccion(
  latitud: number,
  longitud: number,
  senal?: AbortSignal,
): Promise<DireccionResuelta> {
  const parametros = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitud),
    lon: String(longitud),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'es',
  })

  try {
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?${parametros}`, {
      signal: senal ?? AbortSignal.timeout(9000),
      headers: { Accept: 'application/json' },
    })
    if (!respuesta.ok) return DIRECCION_VACIA

    const datos = (await respuesta.json()) as { address?: Record<string, unknown> }
    const direccion = datos.address
    if (!direccion || typeof direccion !== 'object') return DIRECCION_VACIA

    const calle = primero(direccion, ['road', 'pedestrian', 'footway', 'path', 'cycleway'])
    const numero = primero(direccion, ['house_number'])
    const piezas: DireccionResuelta = {
      calle: [calle, numero].filter(Boolean).join(' ') || null,
      colonia: primero(direccion, ['neighbourhood', 'suburb', 'quarter', 'hamlet', 'city_district']),
      ciudad: primero(direccion, ['city', 'town', 'village', 'municipality', 'county']),
      estado: primero(direccion, ['state', 'region']),
      cp: primero(direccion, ['postcode']),
      pais: primero(direccion, ['country']),
      direccion: null,
    }
    return { ...piezas, direccion: componerDireccion(piezas) }
  } catch {
    // Sin conexión, servicio caído o petición cancelada: no es un error grave.
    return DIRECCION_VACIA
  }
}
