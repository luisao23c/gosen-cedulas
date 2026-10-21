'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAviso } from '@/components/AvisoProvider'
import { ESTADO_INICIAL, type AccionFormulario } from '@/features/tipos'

/**
 * Estado común de los formularios en diálogo: abrir/cerrar, error del
 * servidor, «guardando…» y, al terminar bien, aviso + refresco del panel.
 * Así cada Formulario* solo describe sus campos (AGENTS.md §3.5).
 */
export function useFormularioDialogo(
  accion: AccionFormulario,
  mensajeExito: string,
  /** Se llama cuando el servidor guardó bien, antes de refrescar (p. ej. para marcar que ya hay registro) */
  alGuardar?: () => void,
) {
  const router = useRouter()
  const avisar = useAviso()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const abrir = () => {
    setError(null)
    setAbierto(true)
  }
  const cerrar = () => setAbierto(false)

  const enviar = (formData: FormData) => {
    iniciar(async () => {
      const resultado = await accion(ESTADO_INICIAL, formData)
      if (resultado?.error) {
        setError(resultado.error)
        return
      }
      setAbierto(false)
      alGuardar?.()
      avisar(mensajeExito)
      router.refresh()
    })
  }

  return { abierto, abrir, cerrar, error, setError, pendiente, enviar }
}
