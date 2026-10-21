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
import AddIcon from '@mui/icons-material/Add'
import { guardarRama, editarRama } from '@/features/ramas/acciones'
import type { AccionFormulario, OpcionUsuario } from '@/features/tipos'
import AccionPrincipal from '@/components/AccionPrincipal'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

interface Inicial {
  id: number
  nombre: string
  descripcion: string | null
  liderId: number | null
  activa: boolean
}

/**
 * Alta y edición de ramas en un diálogo.
 * El permiso real se comprueba en el servidor (features/ramas/acciones.ts);
 * aquí solo se decide qué se muestra. Al guardar se refresca el panel para
 * que se vean los datos nuevos sin recargar la página.
 */
export default function FormularioRama({
  accion,
  usuarios,
  inicial,
}: {
  accion: 'crear' | 'editar'
  usuarios: OpcionUsuario[]
  inicial?: Inicial
}) {
  const esEdicion = accion === 'editar'
  const accionFormulario: AccionFormulario = esEdicion ? editarRama : guardarRama
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Rama actualizada' : 'Rama creada',
  )

  // Puede liderar una rama quien tiene alcance de rama o de toda la organización
  const candidatosLider = usuarios.filter((usuario) => usuario.alcance !== 'CELULA')

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar rama">
          <IconButton color="primary" onClick={abrir} aria-label="Editar rama">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nueva rama" icono={<AddIcon />} alPulsar={abrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo={esEdicion ? 'Editar rama' : 'Nueva rama'}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {esEdicion && inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

          <TextField
            name="nombre"
            label="Nombre de la rama"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus={!esEdicion}
          />
          <TextField
            name="descripcion"
            label="Descripción (opcional)"
            defaultValue={inicial?.descripcion ?? ''}
            multiline
            minRows={2}
          />

          {esEdicion && inicial ? (
            <>
              <TextField
                select
                name="liderId"
                label="Líder de la rama"
                defaultValue={inicial.liderId ?? ''}
              >
                <MenuItem value="">Sin líder</MenuItem>
                {candidatosLider.map((usuario) => (
                  <MenuItem key={usuario.id} value={usuario.id}>
                    {usuario.nombre} · {usuario.rolNombre}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Switch name="activa" defaultChecked={inicial.activa} />}
                label="Rama activa"
              />
            </>
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
