'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Cabecera de la app (la barra superior del teléfono) con contexto.
 *
 * En una app nativa la barra superior SABE en qué pantalla estás: muestra el
 * botón de volver en las pantallas de detalle, el título cuando la pantalla se
 * desplaza y la acción principal («+ Nuevo») arriba a la derecha. Aquí cada
 * pantalla se lo cuenta a la barra:
 *
 *  · `EncabezadoPagina` registra el título y a dónde se vuelve (`useTituloDePantalla`)
 *  · `AccionPrincipal` registra la acción de la barra (`useAccionDeBarra`)
 *
 * Así la barra deja de ser un adorno igual en todas las pantallas (lo que hace
 * que una web se sienta web) y pasa a ser la pieza de orientación de la app.
 */

export interface AccionDeBarra {
  etiqueta: string
  icono: ReactNode
}

interface EstadoCabecera {
  titulo: string | null
  volverHref: string | null
  accion: AccionDeBarra | null
}

interface ControlCabecera {
  fijarTitulo: (titulo: string | null, volverHref: string | null) => void
  fijarAccion: (accion: AccionDeBarra | null) => void
  /** La acción registrada se guarda en una referencia: siempre se ejecuta la versión más reciente */
  fijarAlPulsar: (alPulsar: (() => void) | null) => void
  ejecutar: () => void
}

const ContextoEstado = createContext<EstadoCabecera>({ titulo: null, volverHref: null, accion: null })
const ContextoControl = createContext<ControlCabecera | null>(null)

export function CabeceraProvider({ children }: { children: ReactNode }) {
  const [titulo, setTitulo] = useState<string | null>(null)
  const [volverHref, setVolverHref] = useState<string | null>(null)
  const [accion, setAccion] = useState<AccionDeBarra | null>(null)
  const alPulsarRef = useRef<(() => void) | null>(null)

  const fijarTitulo = useCallback((nuevo: string | null, volver: string | null) => {
    setTitulo(nuevo)
    setVolverHref(volver)
  }, [])
  const fijarAccion = useCallback((nueva: AccionDeBarra | null) => setAccion(nueva), [])
  const fijarAlPulsar = useCallback((alPulsar: (() => void) | null) => {
    alPulsarRef.current = alPulsar
  }, [])
  const ejecutar = useCallback(() => alPulsarRef.current?.(), [])

  const estado = useMemo(() => ({ titulo, volverHref, accion }), [titulo, volverHref, accion])
  const control = useMemo(
    () => ({ fijarTitulo, fijarAccion, fijarAlPulsar, ejecutar }),
    [fijarTitulo, fijarAccion, fijarAlPulsar, ejecutar],
  )

  return (
    <ContextoControl.Provider value={control}>
      <ContextoEstado.Provider value={estado}>{children}</ContextoEstado.Provider>
    </ContextoControl.Provider>
  )
}

/** Lo que la barra tiene que pintar ahora. */
export function useCabecera(): EstadoCabecera & { ejecutarAccion: () => void } {
  const estado = useContext(ContextoEstado)
  const control = useContext(ContextoControl)
  return { ...estado, ejecutarAccion: () => control?.ejecutar() }
}

/** ¿Hay una barra que recoja la acción principal? (si no, la pantalla pinta su propio botón) */
export function useHayBarra(): boolean {
  return useContext(ContextoControl) != null
}

/** La pantalla le dice a la barra su título y a dónde se vuelve. */
export function useTituloDePantalla(titulo: string, volverHref?: string): void {
  const control = useContext(ContextoControl)
  useEffect(() => {
    control?.fijarTitulo(titulo, volverHref ?? null)
    return () => control?.fijarTitulo(null, null)
  }, [control, titulo, volverHref])
}

/** La pantalla le dice a la barra cuál es su acción principal («+ Nuevo equipo»). */
export function useAccionDeBarra(accion: AccionDeBarra, alPulsar: () => void): void {
  const control = useContext(ContextoControl)
  const { etiqueta } = accion
  // El icono se toma la primera vez: es un elemento nuevo en cada pintado y re-registrarlo en bucle no sirve
  const iconoRef = useRef(accion.icono)

  useEffect(() => {
    control?.fijarAlPulsar(alPulsar)
  })

  useEffect(() => {
    control?.fijarAccion({ etiqueta, icono: iconoRef.current })
    return () => control?.fijarAccion(null)
  }, [control, etiqueta])
}
