'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, IconButton, Tooltip } from '@mui/material'
import PersonRemoveIcon from '@mui/icons-material/PersonRemove'
import { quitarServidor } from '@/features/ministerio/eventos'
import { ESTADO_INICIAL } from '@/features/tipos'
import { useAviso } from '@/components/AvisoProvider'

/**
 * Quitar a alguien de la lista de un evento.
 *
 * Va en dos toques (como las bajas de la casa): el primero pide confirmación y
 * el segundo ejecuta. El servidor impide quitar a quien ya registró su llegada:
 * eso sería borrar la constancia de que sirvió.
 */
export default function AccionQuitarServidor({
  eventoId,
  usuarioId,
  nombre,
  comoBoton = false,
}: {
  eventoId: number
  usuarioId: number
  nombre: string
  comoBoton?: boolean
}) {
  const router = useRouter()
  const avisar = useAviso()
  const [confirmando, setConfirmando] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const ejecutar = () => {
    iniciar(async () => {
      const datos = new FormData()
      datos.set('eventoId', String(eventoId))
      datos.set('usuarioId', String(usuarioId))
      const resultado = await quitarServidor(ESTADO_INICIAL, datos)
      if (resultado.error) {
        avisar(resultado.error)
        setConfirmando(false)
        return
      }
      avisar(`${nombre} salió de la lista`)
      router.refresh()
    })
  }

  if (comoBoton) {
    return (
      <Button
        color="error"
        variant={confirmando ? 'contained' : 'text'}
        size="large"
        disabled={pendiente}
        onClick={() => (confirmando ? ejecutar() : setConfirmando(true))}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        {pendiente
          ? 'Quitando…'
          : confirmando
            ? 'Toca otra vez para quitar'
            : `Quitar a ${nombre}`}
      </Button>
    )
  }

  return (
    <Tooltip title={confirmando ? 'Toca otra vez para quitarlo del evento' : 'Quitar del evento'}>
      <IconButton
        color="error"
        onClick={() => (confirmando ? ejecutar() : setConfirmando(true))}
        disabled={pendiente}
        aria-label={confirmando ? 'Confirmar que se quita del evento' : 'Quitar del evento'}
      >
        <PersonRemoveIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}
