'use client'

import { IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import BadgeIcon from '@mui/icons-material/Badge'
import { asignarFuncion } from '@/features/ministerio/eventos'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/**
 * Cambiar el rol que cumple un servidor en un evento («Cámara 1», «Switcher»…).
 * El servidor exige `evento:asignar` del ministerio del evento.
 */
export default function AccionFuncion({
  eventoId,
  usuarioId,
  nombre,
  funcion,
}: {
  eventoId: number
  usuarioId: number
  nombre: string
  funcion: string | null
}) {
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    asignarFuncion,
    'Rol actualizado',
  )

  return (
    <>
      <Tooltip title="Cambiar su rol en el evento">
        <IconButton onClick={abrir} aria-label={`Cambiar el rol de ${nombre}`}>
          <BadgeIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <DialogoFormulario
        abierto={abierto}
        titulo="Rol en el evento"
        descripcion={nombre}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <input type="hidden" name="eventoId" value={eventoId} />
          <input type="hidden" name="usuarioId" value={usuarioId} />
          <TextField
            name="funcion"
            label="Rol"
            defaultValue={funcion ?? ''}
            placeholder="Cámara 1, Audio, Voz principal, Recepción…"
            autoFocus
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <Typography variant="caption" color="text.secondary">
            Déjalo vacío para quitarle el rol.
          </Typography>
        </Stack>
      </DialogoFormulario>
    </>
  )
}
