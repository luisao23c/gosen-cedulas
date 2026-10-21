'use client'

import { IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import { guardarEquipo, editarEquipo } from '@/features/ministerio/acciones'
import type { AccionFormulario, OpcionMinisterio } from '@/features/tipos'
import { ESTATUS_EQUIPO, ETIQUETAS_ESTATUS_EQUIPO, type EstatusEquipo } from '@/types/domain'
import AccionPrincipal from '@/components/AccionPrincipal'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

interface Inicial {
  id: number
  nombre: string
  descripcion: string | null
  estatus: EstatusEquipo
}

/**
 * Alta y edición de equipos del inventario.
 *
 * El estatus no se toca al crear (todo entra «disponible»); al editar sí, pero
 * el servidor impide marcar «disponible» un equipo que está prestado: primero
 * tiene que volver.
 */
export default function FormularioEquipo({
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
  const accionFormulario: AccionFormulario = esEdicion ? editarEquipo : guardarEquipo
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Equipo actualizado' : 'Equipo agregado',
  )

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar equipo">
          <IconButton color="primary" onClick={abrir} aria-label="Editar equipo">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo equipo" icono={<Inventory2Icon />} alPulsar={abrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo={esEdicion ? 'Editar equipo' : 'Nuevo equipo'}
        descripcion="El equipo se queda en el inventario del ministerio."
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
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
              helperText="Los equipos pertenecen a un ministerio."
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
            label="Nombre del equipo"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus={esEdicion || ministerioId != null}
            placeholder="Ej.: Cámara principal, Micrófono, Guitarra, Proyector…"
          />

          <TextField
            name="descripcion"
            label="Descripción (opcional)"
            defaultValue={inicial?.descripcion ?? ''}
            multiline
            minRows={2}
            placeholder="Marca, modelo, para qué se usa…"
          />

          {esEdicion ? (
            <TextField
              select
              name="estatus"
              label="Estatus"
              defaultValue={inicial?.estatus ?? 'DISPONIBLE'}
              helperText="«Fuera de servicio» da de baja el equipo sin borrar su historial."
            >
              {ESTATUS_EQUIPO.map((estatus) => (
                <MenuItem key={estatus} value={estatus}>
                  {ETIQUETAS_ESTATUS_EQUIPO[estatus]}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
