'use client'

import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturnOutlined'
import { avisarDevolucion } from '@/features/ministerio/acciones'
import { CONSERVACIONES, ETIQUETAS_CONSERVACION } from '@/types/domain'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/**
 * «Ya lo devolví»: quien lleva el equipo avisa que lo regresó y en qué estado.
 * El préstamo pasa a «por revisar»; NO se cierra solo: el ministerio lo cierra
 * cuando de verdad lo recibe (así queda constancia de las dos partes).
 */
export default function AccionAvisarDevolucion({
  prestamoId,
  equipo,
}: {
  prestamoId: number
  equipo: string | null
}) {
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    avisarDevolucion,
    'Avisado: el ministerio lo revisará',
  )

  return (
    <>
      <Button variant="outlined" size="large" startIcon={<KeyboardReturnIcon />} onClick={abrir}>
        Ya lo devolví
      </Button>

      <DialogoFormulario
        abierto={abierto}
        titulo="Avisar que lo devolviste"
        descripcion={equipo ? `«${equipo}»` : undefined}
        etiquetaGuardar="Avisar devolución"
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <input type="hidden" name="id" value={prestamoId} />

          <Typography variant="body2" color="text.secondary">
            Cuando el ministerio lo reciba y lo revise, el préstamo se cierra. Dinos con sinceridad
            cómo lo devuelves.
          </Typography>

          <TextField
            select
            name="estadoDevolucion"
            label="¿En qué estado lo devuelves?"
            defaultValue="BUENO"
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
            label="Notas (opcional)"
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
