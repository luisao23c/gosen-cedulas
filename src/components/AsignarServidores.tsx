'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import { asignarServidores } from '@/features/ministerio/eventos'
import { inicialesDe } from '@/lib/nombres'
import { Avatar } from '@mui/material'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/** Cuenta que puede servir en este ministerio. */
export interface CuentaServidora {
  id: number
  nombre: string
  email: string
}

/**
 * Armar la lista de quién sirve en un evento.
 *
 * Solo aparecen las cuentas del ministerio (y las de organización): el
 * servidor vuelve a comprobarlo, porque los ids llegan del cliente.
 * Quien ya está asignado se muestra marcado y sin poder quitarse desde aquí:
 * para eso está la acción «quitar» de la propia fila, que respeta las llegadas
 * ya registradas.
 */
export default function AsignarServidores({
  eventoId,
  cuentas,
  asignados,
  puede = true,
}: {
  eventoId: number
  cuentas: CuentaServidora[]
  /** Ids que ya están asignados */
  asignados: number[]
  /** Si no hay permiso para asignar, no se pinta el botón */
  puede?: boolean
}) {
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    asignarServidores,
    'Servidores asignados',
  )
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())

  const yaAsignados = new Set(asignados)
  const disponibles = cuentas.filter((cuenta) => !yaAsignados.has(cuenta.id))

  const alAbrir = () => {
    setElegidos(new Set())
    abrir()
  }

  const alternar = (id: number) => {
    setElegidos((anterior) => {
      const siguiente = new Set(anterior)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  if (!puede) return null

  return (
    <>
      <Button
        variant="contained"
        size="large"
        startIcon={<GroupAddIcon />}
        onClick={alAbrir}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        Asignar servidores
      </Button>

      <DialogoFormulario
        abierto={abierto}
        titulo="¿Quién sirve en este evento?"
        descripcion="Elige a las personas; después cada una confirma desde su cuenta."
        etiquetaGuardar="Asignar"
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <input type="hidden" name="eventoId" value={eventoId} />
          {/* Las cuentas elegidas viajan como varios campos «usuario» */}
          {Array.from(elegidos).map((id) => (
            <input key={id} type="hidden" name="usuario" value={id} />
          ))}

          {disponibles.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Ya están asignadas todas las cuentas del ministerio. Para sumar a alguien más,
              primero crea su cuenta en Usuarios con un rol de este ministerio.
            </Typography>
          ) : (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {disponibles.length}{' '}
                  {disponibles.length === 1 ? 'cuenta disponible' : 'cuentas disponibles'}
                </Typography>
                <Button
                  size="small"
                  onClick={() =>
                    setElegidos(
                      elegidos.size === disponibles.length
                        ? new Set()
                        : new Set(disponibles.map((cuenta) => cuenta.id)),
                    )
                  }
                >
                  {elegidos.size === disponibles.length ? 'Quitar todo' : 'Todos'}
                </Button>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                {disponibles.map((cuenta) => (
                  <FormControlLabel
                    key={cuenta.id}
                    sx={{ mx: 0, gap: 1, minHeight: 48 }}
                    control={
                      <Checkbox
                        checked={elegidos.has(cuenta.id)}
                        onChange={() => alternar(cuenta.id)}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>{inicialesDe(cuenta.nombre)}</Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                            {cuenta.nombre}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {cuenta.email}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                ))}
              </Stack>
            </>
          )}

          {yaAsignados.size > 0 ? (
            <>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Ya asignados
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.5}
                  useFlexGap
                  sx={{ flexWrap: 'wrap', mt: 0.5 }}
                >
                  {cuentas
                    .filter((cuenta) => yaAsignados.has(cuenta.id))
                    .map((cuenta) => (
                      <Chip key={cuenta.id} size="small" label={cuenta.nombre} />
                    ))}
                </Stack>
              </Box>
            </>
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
