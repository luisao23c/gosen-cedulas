'use client'

import {
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import EventIcon from '@mui/icons-material/Event'
import { guardarEvento, editarEvento } from '@/features/ministerio/eventos'
import type { AccionFormulario, OpcionMinisterio } from '@/features/tipos'
import type { UbicacionMarcada } from '@/components/CampoUbicacion'
import AccionPrincipal from '@/components/AccionPrincipal'
import CampoUbicacion from '@/components/CampoUbicacion'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

interface Inicial {
  id: number
  nombre: string
  descripcion: string | null
  fecha: string
  horaLlegada: string | null
  ubicacion: UbicacionMarcada
  activo: boolean
}

/**
 * Alta y edición de eventos de servicio.
 *
 * Dos datos son los que hacen que el pase de llegada sirva de algo:
 *  · la HORA a la que tienen que estar (con ella se sabe si llegaron a tiempo)
 *  · el PUNTO donde es (contra él se mide la ubicación de la checada)
 */
export default function FormularioEvento({
  accion,
  ministerioId,
  ministerios,
  inicial,
}: {
  accion: 'crear' | 'editar'
  ministerioId?: number
  ministerios?: OpcionMinisterio[]
  inicial?: Inicial
}) {
  const esEdicion = accion === 'editar'
  const accionFormulario: AccionFormulario = esEdicion ? editarEvento : guardarEvento
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Evento actualizado' : 'Evento creado',
  )

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar evento">
          <IconButton color="primary" onClick={abrir} aria-label="Editar evento">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo evento" icono={<EventIcon />} alPulsar={abrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo={esEdicion ? 'Editar evento' : 'Nuevo evento'}
        descripcion="Después se arma la lista de quién sirve en ese evento."
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
        anchoMaximo="md"
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {esEdicion && inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}
          {ministerioId != null ? (
            <input type="hidden" name="ministerioId" value={ministerioId} />
          ) : null}

          {!esEdicion && ministerioId == null ? (
            <TextField
              select
              name="ministerioId"
              label="Ministerio"
              defaultValue=""
              required
              autoFocus
              helperText="Los eventos pertenecen a un ministerio."
            >
              {(ministerios ?? []).map((ministerio) => (
                <MenuItem key={ministerio.id} value={ministerio.id}>
                  {ministerio.nombre}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <TextField
            name="nombre"
            label="Nombre del evento"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus={esEdicion || ministerioId != null}
            placeholder="Ej.: Culto dominical, Campaña, Boda…"
          />

          <TextField
            name="descripcion"
            label="Descripción (opcional)"
            defaultValue={inicial?.descripcion ?? ''}
            multiline
            minRows={2}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              name="fecha"
              label="Fecha"
              type="date"
              defaultValue={inicial?.fecha ?? ''}
              required
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            <TextField
              name="hora"
              label="Hora a la que deben estar"
              type="time"
              defaultValue={inicial?.horaLlegada ?? ''}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Ej.: 09:30 aunque el servicio empiece a las 10:00"
              sx={{ flex: 1 }}
            />
          </Stack>

          <CampoUbicacion
            etiqueta="Dónde es el evento"
            ayuda="Marca el punto donde tienen que estar. Con él se mide dónde checaron su llegada."
            inicio={inicial?.ubicacion}
          />

          {esEdicion ? (
            <FormControlLabel
              control={<Switch name="activo" defaultChecked={inicial?.activo ?? true} />}
              label="Evento activo"
            />
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
