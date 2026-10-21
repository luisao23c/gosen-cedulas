'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, IconButton, Stack, Tooltip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import UndoIcon from '@mui/icons-material/Undo'
import { confirmarAsistencia } from '@/features/ministerio/eventos'
import { ESTADO_INICIAL } from '@/features/tipos'
import { useAviso } from '@/components/AvisoProvider'

/**
 * «Sí voy» / «ya no puedo» de un turno.
 *
 * El servidor solo manda el id de la persona cuando es el encargado confirmando
 * por alguien más; el propio servidor confirma sin enviar nada, porque su id
 * sale de la sesión (nunca del formulario).
 */
export default function AccionConfirmar({
  eventoId,
  usuarioId,
  confirmado,
  comoBoton = false,
}: {
  eventoId: number
  /** Vacío = mi propio turno */
  usuarioId?: number
  confirmado: boolean
  /** En «Mis turnos» conviene un botón ancho; en la tabla, un icono */
  comoBoton?: boolean
}) {
  const router = useRouter()
  const avisar = useAviso()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // En primera persona solo cuando la acción es del propio servidor: si la hace
  // el encargado por otro, «Confirmo que voy» sería mentira.
  const esPropio = usuarioId == null

  const enviar = () => {
    setError(null)
    const datos = new FormData()
    datos.set('eventoId', String(eventoId))
    if (usuarioId != null) datos.set('usuarioId', String(usuarioId))
    // La casilla marcada significa «confirmo»
    datos.set('confirmado', confirmado ? '' : 'on')

    iniciar(async () => {
      const resultado = await confirmarAsistencia(ESTADO_INICIAL, datos)
      if (resultado.error) {
        setError(resultado.error)
        return
      }
      avisar(confirmado ? 'Se quitó la confirmación' : esPropio ? 'Confirmado: ahí estaré' : 'Confirmado: ahí estará')
      router.refresh()
    })
  }

  const etiqueta = confirmado
    ? esPropio
      ? 'Ya no puedo ir'
      : 'Quitar su confirmación'
    : esPropio
      ? 'Confirmo que voy'
      : 'Confirmar que va'

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      {comoBoton ? (
        <Button
          variant={confirmado ? 'outlined' : 'contained'}
          size="large"
          color={confirmado ? 'inherit' : 'primary'}
          startIcon={confirmado ? <UndoIcon /> : <CheckCircleIcon />}
          onClick={enviar}
          disabled={pendiente}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {pendiente ? 'Guardando…' : etiqueta}
        </Button>
      ) : (
        <Tooltip title={etiqueta}>
          <IconButton
            color={confirmado ? 'success' : 'primary'}
            onClick={enviar}
            disabled={pendiente}
            aria-label={etiqueta}
          >
            {confirmado ? <UndoIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}

      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  )
}
