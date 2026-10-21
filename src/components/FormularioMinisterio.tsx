'use client'

import { useState } from 'react'
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
import { guardarMinisterio, editarMinisterio } from '@/features/ministerio/acciones'
import type { AccionFormulario, OpcionUsuario } from '@/features/tipos'
import AccionPrincipal from '@/components/AccionPrincipal'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

interface Inicial {
  id: number
  nombre: string
  descripcion: string | null
  encargadoId: number | null
  activo: boolean
}

/**
 * Alta y edición de ministerios. Lo lleva una cuenta (el encargado), que es
 * quien organiza el inventario, los préstamos y los eventos de servicio.
 */
export default function FormularioMinisterio({
  accion,
  cuentas,
  inicial,
}: {
  accion: 'crear' | 'editar'
  cuentas: OpcionUsuario[]
  inicial?: Inicial
}) {
  const esEdicion = accion === 'editar'
  // El encargado viaja en estado local: si fuera un `defaultValue` y el dato
  // cambiara mientras el diálogo está abierto (se guarda y refresca la lista),
  // MUI avisa de «uncontrolled Select que cambia su valor inicial».
  const [encargado, setEncargado] = useState<number | ''>(inicial?.encargadoId ?? '')
  const elegirEncargado = () => setEncargado(inicial?.encargadoId ?? '')
  const accionFormulario: AccionFormulario = esEdicion ? editarMinisterio : guardarMinisterio
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Ministerio actualizado' : 'Ministerio creado',
  )

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar ministerio">
          <IconButton color="primary" onClick={() => { elegirEncargado(); abrir() }} aria-label="Editar ministerio">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo ministerio" icono={<AddIcon />} alPulsar={abrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo={esEdicion ? 'Editar ministerio' : 'Nuevo ministerio'}
        descripcion="Los ministerios cruzan las ramas: cámaras, alabanza, sonido…"
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {esEdicion && inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

          <TextField
            name="nombre"
            label="Nombre del ministerio"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus
            placeholder="Ej.: Cámaras, Alabanza, Sonido…"
          />

          <TextField
            name="descripcion"
            label="Descripción (opcional)"
            defaultValue={inicial?.descripcion ?? ''}
            multiline
            minRows={2}
          />

          {esEdicion ? (
            <>
              <TextField
                select
                name="encargadoId"
                label="Encargado del ministerio"
                value={encargado}
                onChange={(evento) =>
                  setEncargado(evento.target.value === '' ? '' : Number(evento.target.value))
                }
                helperText="La cuenta que organiza los equipos, los préstamos y quién sirve."
              >
                <MenuItem value="">Sin encargado</MenuItem>
                {cuentas.map((cuenta) => (
                  <MenuItem key={cuenta.id} value={cuenta.id}>
                    {cuenta.nombre} · {cuenta.rolNombre}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Switch name="activo" defaultChecked={inicial?.activo ?? true} />}
                label="Ministerio activo"
              />
            </>
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
