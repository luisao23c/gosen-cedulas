'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { IconButton, Tooltip } from '@mui/material'
import BlockIcon from '@mui/icons-material/BlockOutlined'
import { useAviso } from '@/components/AvisoProvider'
import { ESTADO_INICIAL, type AccionFormulario } from '@/features/tipos'

/**
 * Baja de un registro desde el listado (células y ramas).
 *
 * En esta aplicación «eliminar» es **desactivar**: la fila deja de aparecer en
 * los listados activos, pero no se borra nada (MEMORY §4, regla 5). Por eso el
 * botón se llama «Dar de baja» y no «Eliminar».
 *
 * Se confirma con dos toques —el mismo gesto que la baja de integrantes— para
 * que un roce en la lista no saque a una rama o a una célula de circulación.
 */
export default function AccionBaja({
  accion,
  id,
  queEs,
  mensajeExito,
}: {
  /** Server action que recibe `id` y desactiva */
  accion: AccionFormulario
  id: number
  /** Cómo se llama el objeto en los textos: «la célula», «la rama» */
  queEs: string
  mensajeExito: string
}) {
  const router = useRouter()
  const avisar = useAviso()
  const [confirmando, setConfirmando] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const baja = () => {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    iniciar(async () => {
      const datos = new FormData()
      datos.set('id', String(id))
      const resultado = await accion(ESTADO_INICIAL, datos)
      if (resultado?.error) {
        avisar(resultado.error)
        setConfirmando(false)
        return
      }
      avisar(mensajeExito)
      router.refresh()
    })
  }

  const titulo = confirmando
    ? `Toca otra vez para dar de baja ${queEs}`
    : `Dar de baja ${queEs}`

  return (
    <Tooltip title={titulo}>
      <IconButton
        color={confirmando ? 'error' : 'default'}
        disabled={pendiente}
        onClick={baja}
        aria-label={titulo}
        sx={{ flexShrink: 0 }}
      >
        <BlockIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}
