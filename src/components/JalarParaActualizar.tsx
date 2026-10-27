'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Box, CircularProgress } from '@mui/material'
import { medidas, movimiento, radios, sombras } from '@/theme/theme'

/** Cuánto hay que jalar (ya amortiguado) para que se actualice. */
const UMBRAL = 56
/** Lo máximo que baja el contenido al jalar. */
const MAXIMO = 96

/**
 * «Jalar para actualizar», el gesto que toda app móvil espera.
 *
 * Una PWA instalada no tiene botón de recargar del navegador: sin este gesto, ver
 * datos nuevos obliga a cerrar y abrir la app. Solo reacciona cuando la pantalla está
 * arriba del todo y el gesto es vertical (el deslizamiento lateral de las filas no se
 * toca). Al soltar pasado el umbral vuelve a pedir los datos al servidor
 * (`router.refresh()`), sin recargar la página ni perder el estado.
 */
export default function JalarParaActualizar({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [distancia, setDistancia] = useState(0)
  const [recargando, setRecargando] = useState(false)
  const [, iniciar] = useTransition()
  const inicio = useRef<{ x: number; y: number } | null>(null)

  const alTocar = (evento: React.TouchEvent) => {
    if (recargando || window.scrollY > 0) return
    const toque = evento.touches[0]
    inicio.current = { x: toque.clientX, y: toque.clientY }
  }

  const alMover = (evento: React.TouchEvent) => {
    const origen = inicio.current
    if (!origen) return
    const toque = evento.touches[0]
    const dy = toque.clientY - origen.y
    const dx = toque.clientX - origen.x
    // Un gesto horizontal (deslizar una fila) o hacia arriba no es de esto
    if (Math.abs(dx) > Math.abs(dy) || dy <= 0 || window.scrollY > 0) {
      if (dy <= 0) setDistancia(0)
      if (Math.abs(dx) > Math.abs(dy)) inicio.current = null
      return
    }
    // Resistencia: cuanto más se jala, más cuesta
    setDistancia(Math.min(dy * 0.5, MAXIMO))
  }

  const alSoltar = () => {
    const listo = distancia >= UMBRAL
    inicio.current = null
    if (!listo) {
      setDistancia(0)
      return
    }
    setRecargando(true)
    setDistancia(UMBRAL)
    iniciar(() => router.refresh())
    // El indicador se queda lo bastante para que se note que pasó algo
    window.setTimeout(() => {
      setRecargando(false)
      setDistancia(0)
    }, 800)
  }

  const progreso = Math.min(distancia / UMBRAL, 1)

  return (
    <Box onTouchStart={alTocar} onTouchMove={alMover} onTouchEnd={alSoltar} onTouchCancel={alSoltar}>
      <Box
        aria-hidden={!recargando}
        sx={{
          position: 'fixed',
          left: '50%',
          top: `calc(${medidas.altoBarraSuperior.movil}px + env(safe-area-inset-top, 0px))`,
          zIndex: 'appBar',
          display: { xs: 'grid', md: 'none' },
          placeItems: 'center',
          width: 40,
          height: 40,
          borderRadius: `${radios.pill}px`,
          bgcolor: 'background.paper',
          boxShadow: sombras.media,
          pointerEvents: 'none',
          opacity: distancia > 4 || recargando ? 1 : 0,
          transform: `translate(-50%, ${Math.max(distancia - 44, -44)}px) scale(${0.6 + progreso * 0.4})`,
          transition: distancia === 0 || recargando ? `transform ${movimiento.normal} ${movimiento.curva}, opacity ${movimiento.normal} linear` : 'none',
        }}
      >
        {recargando ? (
          <CircularProgress size={22} />
        ) : (
          <CircularProgress size={22} variant="determinate" value={progreso * 100} />
        )}
      </Box>

      <Box
        sx={{
          transform: distancia > 0 ? `translateY(${distancia * 0.6}px)` : 'none',
          transition: distancia === 0 || recargando ? `transform ${movimiento.normal} ${movimiento.curva}` : 'none',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
