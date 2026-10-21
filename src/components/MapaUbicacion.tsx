'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { colores, mapa as mapaTokens, radios, sombras } from '@/theme/theme'
import { redondearCoordenada } from '@/lib/geo'

type Props = {
  /** Punto marcado (si lo hay) */
  latitud?: number | null
  longitud?: number | null
  /** Solo lectura: se ve el punto y se puede mover/zoomar, pero no marcarlo */
  soloLectura?: boolean
  /** Al marcar un punto nuevo en el mapa */
  alElegir?: (latitud: number, longitud: number) => void
  /** Descripción para lectores de pantalla */
  etiqueta: string
}

const esNumero = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor)

/**
 * Lienzo de mapa (Leaflet + OpenStreetMap) para marcar o mostrar un punto.
 *
 * El mapa se crea UNA vez por montaje y después solo sigue a las props: no se
 * rehace cuando cambian las coordenadas (si se rehiciera, se perdería el
 * encuadre cada vez que alguien toca el mapa). El punto es un `divIcon` con los
 * tokens del tema, porque el icono por defecto de Leaflet llega como imagen
 * suelta y el empaquetador no la encuentra.
 */
export default function MapaUbicacion({
  latitud,
  longitud,
  soloLectura = false,
  alElegir,
  etiqueta,
}: Props) {
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const mapaRef = useRef<Leaflet.Map | null>(null)
  const marcadorRef = useRef<Leaflet.Marker | null>(null)
  const moduloRef = useRef<(typeof import('leaflet')) | null>(null)

  // Los callbacks y las props cambian en cada render; el mapa los lee por ref
  // para no tener que reconstruirse.
  const puntoRef = useRef({ latitud, longitud })
  const elegirRef = useRef(alElegir)
  const soloLecturaRef = useRef(soloLectura)

  /**
   * Coloca (o quita) el marcador según el punto actual, sin tocar el mapa.
   * Lee todo por refs para ser estable: así el mapa se crea una sola vez.
   */
  const sincronizar = useCallback(() => {
    const L = moduloRef.current
    const lienzo = mapaRef.current
    if (!L || !lienzo) return

    const punto = puntoRef.current
    if (!esNumero(punto.latitud) || !esNumero(punto.longitud)) {
      marcadorRef.current?.remove()
      marcadorRef.current = null
      return
    }

    const posicion: [number, number] = [punto.latitud, punto.longitud]

    if (marcadorRef.current) {
      marcadorRef.current.setLatLng(posicion)
    } else {
      const icono = L.divIcon({
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        html: `<span style="display:block;width:26px;height:26px;border-radius:${radios.pill}px;background-color:${colores.primario};border:3px solid ${colores.superficie};box-shadow:${sombras.alta}"></span>`,
      })
      marcadorRef.current = L.marker(posicion, { icon: icono, keyboard: false }).addTo(lienzo)
    }

    lienzo.setView(posicion, Math.max(lienzo.getZoom(), mapaTokens.zoomPunto))
  }, [])

  // Las props más recientes, sin rehacer el mapa
  useEffect(() => {
    puntoRef.current = { latitud, longitud }
    elegirRef.current = alElegir
    soloLecturaRef.current = soloLectura
  }, [latitud, longitud, alElegir, soloLectura])

  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return

    let cancelado = false
    let observador: ResizeObserver | null = null

    void (async () => {
      const L = await import('leaflet')
      if (cancelado) return

      moduloRef.current = L
      const punto = puntoRef.current
      const puntoValido = esNumero(punto.latitud) && esNumero(punto.longitud)
      const centro: [number, number] = puntoValido
        ? [punto.latitud as number, punto.longitud as number]
        : [mapaTokens.centro.latitud, mapaTokens.centro.longitud]

      const lienzo = L.map(contenedor, {
        center: centro,
        zoom: puntoValido ? mapaTokens.zoomPunto : mapaTokens.zoom,
        // La rueda no debe secuestrar el desplazamiento de la página
        scrollWheelZoom: false,
        zoomControl: true,
      })
      mapaRef.current = lienzo

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(lienzo)

      lienzo.on('click', (evento: Leaflet.LeafletMouseEvent) => {
        if (soloLecturaRef.current) return
        elegirRef.current?.(
          redondearCoordenada(evento.latlng.lat),
          redondearCoordenada(evento.latlng.lng),
        )
      })

      // El diálogo entra con animación y en móvil es pantalla completa: el
      // lienzo tiene que recalcular su tamaño cuando cambia el contenedor.
      observador = new ResizeObserver(() => lienzo.invalidateSize())
      observador.observe(contenedor)

      sincronizar()
    })()

    return () => {
      cancelado = true
      observador?.disconnect()
      marcadorRef.current?.remove()
      marcadorRef.current = null
      mapaRef.current?.remove()
      mapaRef.current = null
      moduloRef.current = null
    }
    // `sincronizar` es estable (todo por refs): el mapa se crea una sola vez.
  }, [sincronizar])

  // Sigue al punto marcado sin recrear el mapa.
  useEffect(() => {
    sincronizar()
  }, [sincronizar, latitud, longitud])

  return (
    <Box
      ref={contenedorRef}
      role="application"
      aria-label={etiqueta}
      sx={{
        height: { xs: mapaTokens.alto.movil, md: mapaTokens.alto.escritorio },
        width: '100%',
        borderRadius: `${radios.grande}px`,
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    />
  )
}
