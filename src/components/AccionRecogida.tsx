'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, IconButton, Stack, Tooltip } from '@mui/material'
import InventoryIcon from '@mui/icons-material/InventoryOutlined'
import { confirmarRecogida } from '@/features/ministerio/acciones'
import { ESTADO_INICIAL } from '@/features/tipos'
import { useAviso } from '@/components/AvisoProvider'

/**
 * «Ya lo recogí»: quien lleva el equipo confirma que lo tiene en sus manos.
 * Hasta entonces el préstamo está «por recoger» (el equipo ya está apartado,
 * pero nadie confirmó que se lo llevó). Va en un toque, como la confirmación de
 * un turno: lo autoriza el propio préstamo, no un permiso de módulo.
 */
export default function AccionRecogida({
  prestamoId,
  equipo,
  comoBoton = false,
  compacto = false,
}: {
  prestamoId: number
  equipo: string | null
  /** En «Mi servicio» conviene un botón ancho; en la tabla, un icono */
  comoBoton?: boolean
  /** Botón pequeño con texto, para dentro de una fila de lista */
  compacto?: boolean
}) {
  const router = useRouter()
  const avisar = useAviso()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const enviar = () => {
    setError(null)
    const datos = new FormData()
    datos.set('id', String(prestamoId))
    iniciar(async () => {
      const resultado = await confirmarRecogida(ESTADO_INICIAL, datos)
      if (resultado.error) {
        setError(resultado.error)
        return
      }
      avisar(equipo ? `Confirmado: ya tienes «${equipo}»` : 'Confirmado: ya lo tienes')
      router.refresh()
    })
  }

  return (
    <Stack spacing={1} sx={{ alignItems: comoBoton ? 'stretch' : 'flex-start' }}>
      {compacto ? (
        <Button
          size="small"
          variant="contained"
          startIcon={<InventoryIcon />}
          onClick={enviar}
          disabled={pendiente}
        >
          {pendiente ? 'Guardando…' : 'Confirmar entrega'}
        </Button>
      ) : comoBoton ? (
        <Button
          variant="contained"
          size="large"
          startIcon={<InventoryIcon />}
          onClick={enviar}
          disabled={pendiente}
        >
          {pendiente ? 'Guardando…' : 'Ya lo recogí'}
        </Button>
      ) : (
        <Tooltip title="Confirmar que ya lo recogió">
          <IconButton color="primary" onClick={enviar} disabled={pendiente} aria-label="Confirmar recogida">
            <InventoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  )
}
