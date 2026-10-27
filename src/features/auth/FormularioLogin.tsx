'use client'

import { useActionState, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import MailOutlinedIcon from '@mui/icons-material/MailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined'
import { iniciarSesion } from '@/features/auth/acciones'
import { ESTADO_INICIAL, type EstadoFormulario } from '@/features/tipos'

/**
 * Entrada al sistema. Usa `useActionState` porque el login es la única
 * pantalla que necesita mostrar el error sin perder lo escrito (el resto de
 * formularios van en diálogo con `useFormularioDialogo`).
 */
export default function FormularioLogin() {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    iniciarSesion,
    ESTADO_INICIAL,
  )

  const [verClave, setVerClave] = useState(false)

  return (
    <Box
      component="form"
      action={enviar}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {estado.error ? <Alert severity="error">{estado.error}</Alert> : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label="Correo"
        placeholder="tu@correo.com"
        autoComplete="username"
        required
        autoFocus
        slotProps={{
          htmlInput: { inputMode: 'email', autoCapitalize: 'none' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <MailOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <TextField
        id="contrasena"
        name="contrasena"
        type={verClave ? 'text' : 'password'}
        label="Contraseña"
        autoComplete="current-password"
        required
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setVerClave((valor) => !valor)}
                >
                  {verClave ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={pendiente}
        startIcon={pendiente ? <CircularProgress size={16} color="inherit" /> : undefined}
        sx={{ mt: 0.5 }}
      >
        {pendiente ? 'Entrando…' : 'Entrar'}
      </Button>

      <Divider sx={{ mt: 1 }} />

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        ¿Aún no tienes cuenta? Pídele a un administrador que te la cree.
      </Typography>
    </Box>
  )
}
