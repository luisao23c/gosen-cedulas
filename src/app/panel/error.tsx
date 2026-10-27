'use client'

import PantallaDeError from '@/components/PantallaDeError'

/** Si una pantalla del panel falla al cargar, se ve esto en lugar de una pantalla en blanco. */
export default function ErrorDelPanel({
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
      volverHref="/panel"
      volverEtiqueta="Volver al inicio"
    />
  )
}
