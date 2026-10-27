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
import EditIcon from '@mui/icons-material/EditOutlined'
import PersonAddIcon from '@mui/icons-material/PersonAddOutlined'
import { guardarUsuario, editarUsuario } from '@/features/usuarios/acciones'
import type {
  AccionFormulario,
  OpcionCelula,
  OpcionMinisterio,
  OpcionRama,
  OpcionRol,
} from '@/features/tipos'
import { DESCRIPCION_ALCANCE } from '@/lib/auth/catalogo'
import AccionPrincipal from '@/components/AccionPrincipal'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

interface Inicial {
  id: number
  nombre: string
  rolId: number
  ramaId: number | null
  celulaId: number | null
  ministerioId: number | null
  activa: boolean
}

/**
 * Alta y edición de cuentas de usuario.
 * El rol (creado en /panel/roles) decide qué desplegable aparece según su
 * alcance: rol de rama → pide rama, rol de célula → pide célula, rol de
 * ministerio → pide ministerio, rol de organización → ninguno.
 */
export default function FormularioUsuario({
  accion,
  roles,
  ramas,
  celulas,
  ministerios,
  inicial,
}: {
  accion: 'crear' | 'editar'
  roles: OpcionRol[]
  ramas: OpcionRama[]
  celulas: (OpcionCelula & { nombreRama: string | null })[]
  ministerios: OpcionMinisterio[]
  inicial?: Inicial
}) {
  const esEdicion = accion === 'editar'
  const accionFormulario: AccionFormulario = esEdicion ? editarUsuario : guardarUsuario
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Cuenta actualizada' : 'Cuenta creada',
  )

  const [rolId, setRolId] = useState<string>(inicial ? String(inicial.rolId) : '')
  const rol = roles.find((opcion) => String(opcion.id) === rolId)

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar usuario">
          <IconButton color="primary" onClick={abrir} aria-label="Editar usuario">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo usuario" icono={<PersonAddIcon />} alPulsar={abrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo={esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {esEdicion && inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

          {esEdicion ? null : (
            <TextField
              name="email"
              type="email"
              label="Correo"
              autoComplete="off"
              required
              autoFocus
              slotProps={{ htmlInput: { inputMode: 'email', autoCapitalize: 'none' } }}
            />
          )}

          <TextField
            name="nombre"
            label="Nombre completo"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus={esEdicion}
          />

          <TextField
            name="contrasena"
            type="password"
            label={esEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            autoComplete="new-password"
            required={!esEdicion}
            helperText={
              esEdicion
                ? 'Déjala vacía para mantener la actual · mínimo 8 caracteres'
                : 'Mínimo 8 caracteres'
            }
          />

          <TextField
            select
            name="rolId"
            label="Rol"
            value={rolId}
            onChange={(evento) => setRolId(evento.target.value)}
            required
            helperText={
              rol
                ? `${rol.descripcion ? `${rol.descripcion} ` : ''}${DESCRIPCION_ALCANCE[rol.alcance]}`
                : 'Define qué puede ver y hacer esta cuenta'
            }
          >
            {roles.map((opcion) => (
              <MenuItem key={opcion.id} value={String(opcion.id)}>
                {opcion.nombre}
              </MenuItem>
            ))}
          </TextField>

          {rol?.alcance === 'RAMA' ? (
            <TextField
              select
              name="ramaId"
              label="Rama asignada"
              defaultValue={inicial?.ramaId ?? ''}
              required
            >
              <MenuItem value="">— Elige una rama —</MenuItem>
              {ramas.map((rama) => (
                <MenuItem key={rama.id} value={rama.id}>
                  {rama.nombre}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          {rol?.alcance === 'CELULA' ? (
            <TextField
              select
              name="celulaId"
              label="Célula asignada"
              defaultValue={inicial?.celulaId ?? ''}
              required
            >
              <MenuItem value="">— Elige una célula —</MenuItem>
              {celulas.map((celula) => (
                <MenuItem key={celula.id} value={celula.id}>
                  {celula.nombreRama ? `${celula.nombreRama} · ${celula.nombre}` : celula.nombre}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          {rol?.alcance === 'MINISTERIO' ? (
            <TextField
              select
              name="ministerioId"
              label="Ministerio asignado"
              defaultValue={inicial?.ministerioId ?? ''}
              required
            >
              <MenuItem value="">— Elige un ministerio —</MenuItem>
              {ministerios.map((ministerio) => (
                <MenuItem key={ministerio.id} value={ministerio.id}>
                  {ministerio.nombre}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          {esEdicion ? (
            <FormControlLabel
              control={<Switch name="activa" defaultChecked={inicial?.activa ?? true} />}
              label="Cuenta activa"
            />
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
