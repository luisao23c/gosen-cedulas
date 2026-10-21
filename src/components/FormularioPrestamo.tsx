'use client'

import { IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import AddIcon from '@mui/icons-material/Add'
import { guardarPrestamo } from '@/features/ministerio/acciones'
import type { OpcionUsuario } from '@/features/tipos'
import { CONSERVACIONES, ETIQUETAS_CONSERVACION } from '@/types/domain'
import AccionPrincipal from '@/components/AccionPrincipal'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/** Equipo disponible para prestar, con el nombre de su ministerio si aplica. */
export interface EquipoPrestable {
  id: number
  nombre: string
  ministerio: string | null
}

/**
 * Abrir un préstamo: quién se lleva el equipo, a quién se le asigna y en qué
 * estado sale.
 *
 * Una cuenta puede traer varios equipos a la vez: cada préstamo es una fila
 * independiente, así que este formulario se puede usar varias veces.
 */
export default function FormularioPrestamo({
  equipos,
  cuentas,
  equipoIdInicial,
  comoIcono = false,
}: {
  equipos: EquipoPrestable[]
  cuentas: OpcionUsuario[]
  /** Equipo ya elegido (cuando se presta desde la fila del inventario) */
  equipoIdInicial?: number
  /** En la fila de un equipo: botón de icono en vez de la acción principal */
  comoIcono?: boolean
}) {
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    guardarPrestamo,
    'Préstamo registrado',
  )

  const sinEquipos = equipos.length === 0

  return (
    <>
      {comoIcono ? (
        <Tooltip title="Prestar este equipo">
          <IconButton color="primary" onClick={abrir} aria-label="Prestar este equipo">
            <SwapHorizIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo préstamo" icono={<AddIcon />} alPulsar={abrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo="Nuevo préstamo"
        descripcion="El equipo queda «prestado» hasta que se registre su devolución."
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {sinEquipos ? (
            <TextField
              select
              name="equipoId"
              label="Equipo"
              defaultValue=""
              disabled
              helperText="No hay equipos disponibles: todos están prestados o fuera de servicio."
            />
          ) : (
            <TextField
              select
              name="equipoId"
              label="Equipo"
              defaultValue={equipoIdInicial != null ? String(equipoIdInicial) : ''}
              required
              autoFocus
            >
              {equipos.map((equipo) => (
                <MenuItem key={equipo.id} value={equipo.id}>
                  {equipo.ministerio ? `${equipo.nombre} · ${equipo.ministerio}` : equipo.nombre}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            select
            name="responsableId"
            label="Quién lo trae"
            defaultValue=""
            required
            helperText="La persona que responde por el equipo mientras esté fuera."
          >
            {cuentas.map((cuenta) => (
              <MenuItem key={cuenta.id} value={cuenta.id}>
                {cuenta.nombre} · {cuenta.rolNombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            name="asignadoAId"
            label="A quién se le asigna (opcional)"
            defaultValue=""
            helperText="Si el equipo lo usa alguien distinto de quien lo trae."
          >
            <MenuItem value="">Sin asignar</MenuItem>
            {cuentas.map((cuenta) => (
              <MenuItem key={cuenta.id} value={cuenta.id}>
                {cuenta.nombre} · {cuenta.rolNombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            name="estadoEntrega"
            label="Cómo sale el equipo"
            defaultValue="BUENO"
            required
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
            placeholder="Para qué evento sale, con quién va, batería cargada…"
          />
        </Stack>
      </DialogoFormulario>
    </>
  )
}
