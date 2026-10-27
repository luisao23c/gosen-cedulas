'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import AddModeratorIcon from '@mui/icons-material/AddModeratorOutlined'
import CheckIcon from '@mui/icons-material/CheckOutlined'
import { guardarRol, editarRol, borrarRol } from '@/features/roles/acciones'
import { ESTADO_INICIAL, type AccionFormulario } from '@/features/tipos'
import {
  ALCANCES,
  CATALOGO,
  DESCRIPCION_ALCANCE,
  ETIQUETAS_ACCION,
  ETIQUETAS_ALCANCE,
  RANGO_ALCANCE,
  RECURSOS,
  permiso,
  permisoCompatibleConAlcance,
  type Alcance,
  type Recurso,
} from '@/lib/auth/catalogo'
import AccionPrincipal from '@/components/AccionPrincipal'
import { useAviso } from '@/components/AvisoProvider'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

interface Inicial {
  id: number
  nombre: string
  descripcion: string | null
  alcance: Alcance
  permisos: string[]
  totalUsuarios: number
}

/**
 * Alta y edición de roles: nombre, hasta dónde llega (alcance) y la matriz de
 * permisos. Cada permiso es una pastilla que se enciende y apaga con un toque.
 *
 * La interfaz impide marcar lo que no se puede (permisos de gestión en roles
 * de rama/célula, o permisos que quien edita no tiene), pero el servidor lo
 * vuelve a comprobar: esto es comodidad, no seguridad.
 */
export default function FormularioRol({
  accion,
  inicial,
  actor,
  puedeEliminar = false,
}: {
  accion: 'crear' | 'editar'
  inicial?: Inicial
  /** Lo que tiene quien edita: no puede conceder más que eso */
  actor: { permisos: string[]; alcance: Alcance }
  puedeEliminar?: boolean
}) {
  const esEdicion = accion === 'editar'
  const router = useRouter()
  const avisar = useAviso()
  const accionFormulario: AccionFormulario = esEdicion ? editarRol : guardarRol
  const { abierto, abrir, cerrar, error, setError, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Rol actualizado' : 'Rol creado',
  )

  const [alcance, setAlcance] = useState<Alcance>(inicial?.alcance ?? 'CELULA')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(inicial?.permisos ?? []))
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, iniciarBorrado] = useTransition()

  const alAbrir = () => {
    // Cada vez que se abre vuelve al estado guardado (no arrastra cambios cancelados)
    setAlcance(inicial?.alcance ?? 'CELULA')
    setSeleccion(new Set(inicial?.permisos ?? []))
    setConfirmandoBorrado(false)
    abrir()
  }

  const motivoBloqueo = (texto: string): string | null => {
    if (!permisoCompatibleConAlcance(texto, alcance)) {
      return `Solo para roles de alcance «${ETIQUETAS_ALCANCE.ORGANIZACION}»`
    }
    if (!actor.permisos.includes(texto)) return 'No puedes conceder un permiso que tú no tienes'
    return null
  }

  const alternar = (texto: string) => {
    setSeleccion((anterior) => {
      const siguiente = new Set(anterior)
      if (siguiente.has(texto)) siguiente.delete(texto)
      else siguiente.add(texto)
      return siguiente
    })
  }

  const marcarRecurso = (recurso: Recurso, valor: boolean) => {
    setSeleccion((anterior) => {
      const siguiente = new Set(anterior)
      for (const accionRecurso of CATALOGO[recurso].acciones) {
        const texto = permiso(recurso, accionRecurso)
        if (!valor) siguiente.delete(texto)
        else if (!motivoBloqueo(texto)) siguiente.add(texto)
      }
      return siguiente
    })
  }

  const cambiarAlcance = (nuevo: Alcance) => {
    setAlcance(nuevo)
    // Al acotar el rol se quitan los permisos que ese alcance no admite
    setSeleccion((anterior) => {
      const siguiente = new Set<string>()
      for (const texto of anterior) {
        if (permisoCompatibleConAlcance(texto, nuevo)) siguiente.add(texto)
      }
      return siguiente
    })
  }

  const eliminar = () => {
    if (!inicial) return
    iniciarBorrado(async () => {
      const datos = new FormData()
      datos.set('id', String(inicial.id))
      const resultado = await borrarRol(ESTADO_INICIAL, datos)
      if (resultado.error) {
        setError(resultado.error)
        setConfirmandoBorrado(false)
        return
      }
      cerrar()
      avisar('Rol eliminado')
      router.refresh()
    })
  }

  const alcanceBloqueado = esEdicion && (inicial?.totalUsuarios ?? 0) > 0

  let accionesExtra = null
  if (esEdicion && puedeEliminar && inicial) {
    accionesExtra =
      inicial.totalUsuarios > 0 ? (
        <Typography variant="caption" color="text.secondary">
          Para eliminarlo, primero cambia a otro rol sus {inicial.totalUsuarios}{' '}
          {inicial.totalUsuarios === 1 ? 'cuenta' : 'cuentas'}.
        </Typography>
      ) : (
        <Button
          color="error"
          variant={confirmandoBorrado ? 'contained' : 'text'}
          disabled={borrando || pendiente}
          onClick={() => (confirmandoBorrado ? eliminar() : setConfirmandoBorrado(true))}
        >
          {borrando
            ? 'Eliminando…'
            : confirmandoBorrado
              ? 'Toca otra vez para eliminar'
              : 'Eliminar rol'}
        </Button>
      )
  }

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar rol">
          <IconButton color="primary" onClick={alAbrir} aria-label="Editar rol">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo rol" icono={<AddModeratorIcon />} alPulsar={alAbrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo={esEdicion ? 'Editar rol' : 'Nuevo rol'}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente || borrando}
        error={error}
        anchoMaximo="md"
        accionesExtra={accionesExtra}
      >
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {esEdicion && inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}
          {/*
            Un control deshabilitado NO viaja en el FormData: sin este campo
            oculto, guardar un rol con cuentas fallaba siempre con «Elige hasta
            dónde llega el rol» aunque el alcance no se pudiera tocar.
          */}
          {alcanceBloqueado ? <input type="hidden" name="alcance" value={alcance} /> : null}
          {/* Los permisos marcados viajan como varios campos «permiso» */}
          {Array.from(seleccion).map((texto) => (
            <input key={texto} type="hidden" name="permiso" value={texto} />
          ))}

          <TextField
            name="nombre"
            label="Nombre del rol"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus={!esEdicion}
            placeholder="Ej.: Secretaría, Coordinador de zona…"
          />

          <TextField
            name="descripcion"
            label="Descripción (opcional)"
            defaultValue={inicial?.descripcion ?? ''}
            multiline
            minRows={2}
          />

          <TextField
            select
            name="alcance"
            label="¿Hasta dónde llega este rol?"
            value={alcance}
            onChange={(evento) => cambiarAlcance(evento.target.value as Alcance)}
            disabled={alcanceBloqueado}
            helperText={
              alcanceBloqueado
                ? 'Tiene cuentas asignadas: para cambiar el alcance, muévelas antes a otro rol.'
                : DESCRIPCION_ALCANCE[alcance]
            }
          >
            {ALCANCES.map((valor) => (
              <MenuItem
                key={valor}
                value={valor}
                disabled={RANGO_ALCANCE[valor] > RANGO_ALCANCE[actor.alcance]}
              >
                {ETIQUETAS_ALCANCE[valor]}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <Typography variant="h6" component="h3">
              Permisos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Toca para activar o desactivar. {seleccion.size}{' '}
              {seleccion.size === 1 ? 'permiso activo' : 'permisos activos'}.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            }}
          >
            {RECURSOS.map((recurso) => {
              const definicion = CATALOGO[recurso]
              const permisosRecurso = definicion.acciones.map((a) => permiso(recurso, a))
              const marcables = permisosRecurso.filter((texto) => !motivoBloqueo(texto))
              const todosMarcados =
                marcables.length > 0 && marcables.every((texto) => seleccion.has(texto))

              return (
                <Paper key={recurso} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1">{definicion.etiqueta}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {definicion.descripcion}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      disabled={marcables.length === 0}
                      onClick={() => marcarRecurso(recurso, !todosMarcados)}
                    >
                      {todosMarcados ? 'Quitar todo' : 'Todo'}
                    </Button>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                    {definicion.acciones.map((accionRecurso) => {
                      const texto = permiso(recurso, accionRecurso)
                      const activo = seleccion.has(texto)
                      const bloqueo = motivoBloqueo(texto)
                      const pastilla = (
                        <Chip
                          label={ETIQUETAS_ACCION[accionRecurso]}
                          icon={activo ? <CheckIcon /> : undefined}
                          color={activo ? 'primary' : 'default'}
                          variant={activo ? 'filled' : 'outlined'}
                          clickable
                          disabled={Boolean(bloqueo) && !activo}
                          aria-pressed={activo}
                          onClick={() => {
                            // Un permiso ya marcado siempre se puede quitar
                            if (activo || !bloqueo) alternar(texto)
                          }}
                          sx={{ height: 36, px: 0.5 }}
                        />
                      )
                      return bloqueo && !activo ? (
                        <Tooltip key={texto} title={bloqueo}>
                          <span>{pastilla}</span>
                        </Tooltip>
                      ) : (
                        <Box key={texto} component="span">
                          {pastilla}
                        </Box>
                      )
                    })}
                  </Box>
                </Paper>
              )
            })}
          </Box>
        </Stack>
      </DialogoFormulario>
    </>
  )
}
