'use client'

import { IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import { registrarDevolucion } from '@/features/ministerio/acciones'
import { CONSERVACIONES, ETIQUETAS_CONSERVACION, type ConservacionEquipo } from '@/types/domain'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/**
 * Recibir un equipo prestado: se registra la hora de la devolución (la pone la
 * base al guardar) y en qué estado volvió. Sin esto, el equipo sigue
 * «prestado» y no se puede prestar otra vez.
 */
export default function AccionDevolucion({
  prestamoId,
  equipo,
  responsable,
  estadoAvisado = null,
}: {
  prestamoId: number
  equipo: string | null
  responsable: string | null
  /** Si quien lo trae ya avisó que lo devolvió, el estado que declaró (viene preseleccionado) */
  estadoAvisado?: ConservacionEquipo | null
}) {
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    registrarDevolucion,
    'Devolución registrada',
  )

  return (
    <>
      <Tooltip title={estadoAvisado ? 'Confirmar que lo recibiste' : 'Registrar devolución'}>
        <IconButton
          color={estadoAvisado ? 'warning' : 'primary'}
          onClick={abrir}
          aria-label={estadoAvisado ? 'Confirmar recepción' : 'Registrar devolución'}
        >
          <AssignmentTurnedInIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <DialogoFormulario
        abierto={abierto}
        titulo={estadoAvisado ? 'Confirmar recepción' : 'Registrar devolución'}
        descripcion={
          equipo ? `«${equipo}»${responsable ? ` · lo traía ${responsable}` : ''}` : undefined
        }
        etiquetaGuardar={estadoAvisado ? 'Confirmar recepción' : 'Registrar devolución'}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <input type="hidden" name="id" value={prestamoId} />

          <Typography variant="body2" color="text.secondary">
            {estadoAvisado
              ? `Quien lo trae avisó que lo devolvió «${ETIQUETAS_CONSERVACION[estadoAvisado].toLowerCase()}». Revísalo y confirma en qué estado lo recibes.`
              : 'Al guardar se anota la hora a la que volvió el equipo y queda disponible otra vez.'}
          </Typography>

          <TextField
            select
            name="estadoDevolucion"
            label="¿En qué estado lo recibiste?"
            defaultValue={estadoAvisado ?? 'BUENO'}
            required
            autoFocus
          >
            {CONSERVACIONES.map((estado) => (
              <MenuItem key={estado} value={estado}>
                {ETIQUETAS_CONSERVACION[estado]}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            name="notas"
            label="Notas de la devolución (opcional)"
            defaultValue=""
            multiline
            minRows={2}
            placeholder="Faltó un cable, la batería volvió descargada…"
          />
        </Stack>
      </DialogoFormulario>
    </>
  )
}
