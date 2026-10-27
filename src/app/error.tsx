'use client'

import PantallaDeError from '@/components/PantallaDeError'

/** Red de seguridad fuera del panel (inicio de sesión, rutas públicas): siempre en español y con salida. */
export default function ErrorDeLaAplicacion({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PantallaDeError
      reset={reset}
      codigo={error.digest}
      volverHref="/"
      volverEtiqueta="Ir al inicio"
      pantallaCompleta
    />
  )
}
