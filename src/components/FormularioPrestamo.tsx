'use client'

import { useState } from 'react'
import { formatearFecha } from '@/lib/fechas'
import { IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import AddIcon from '@mui/icons-material/Add'
import { guardarPrestamo } from '@/features/ministerio/acciones'
import type { MiembroMinisterio } from '@/lib/db/ministerios'
import { CONSERVACIONES, ETIQUETAS_CONSERVACION } from '@/types/domain'
import AccionPrincipal from '@/components/AccionPrincipal'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/** Equipo disponible para prestar, con el nombre de su ministerio si aplica. */
export interface EquipoPrestable {
  id: number
  nombre: string
  ministerio: string | null
  ministerioId: number
}

/** Evento al que se puede ligar un préstamo (próximo o de hoy). */
export interface EventoLigable {
  id: number
  nombre: string
  fecha: string
  ministerioId: number
}

/**
 * Abrir un préstamo: a quién se le presta (un integrante del ministerio del equipo)
 * y en qué estado sale.
 *
 * Una cuenta puede traer varios equipos a la vez: cada préstamo es una fila
 * independiente, así que este formulario se puede usar varias veces.
 */
export default function FormularioPrestamo({
  equipos,
  cuentas,
  eventos = [],
  equipoIdInicial,
  comoIcono = false,
}: {
  equipos: EquipoPrestable[]
  /** Integrantes de los ministerios a los que se puede prestar (se filtran por el equipo elegido) */
  cuentas: MiembroMinisterio[]
  /** Eventos a los que se puede ligar el préstamo */
  eventos?: EventoLigable[]
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
  const [equipoId, setEquipoId] = useState(equipoIdInicial != null ? String(equipoIdInicial) : '')
  // Solo se ofrecen los eventos del mismo ministerio que el equipo elegido
  const ministerioDelEquipo = equipos.find((equipo) => String(equipo.id) === equipoId)?.ministerioId
  const eventosDelEquipo = eventos.filter((evento) => evento.ministerioId === ministerioDelEquipo)
  const miembrosDelEquipo = cuentas.filter((cuenta) => cuenta.ministerioId === ministerioDelEquipo)

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
              value={equipoId}
              // Los MenuItem llevan el id como número: se guarda como texto para compararlo con `String(id)`
              onChange={(evento) => setEquipoId(String(evento.target.value))}
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

          {/* Una sola pregunta: a quién se le presta. Solo salen integrantes del ministerio
              al que pertenece el equipo elegido; quien lo recibe es también quien responde. */}
          <TextField
            select
            key={`persona-${ministerioDelEquipo ?? 'sin-equipo'}`}
            name="asignadoAId"
            label="¿A quién se le presta?"
            defaultValue=""
            required
            disabled={ministerioDelEquipo == null}
            helperText={
              ministerioDelEquipo == null
                ? 'Elige primero el equipo.'
                : miembrosDelEquipo.length === 0
                  ? 'Este ministerio todavía no tiene integrantes con cuenta.'
                  : 'Solo integrantes de este ministerio. Quien lo recibe responde por él.'
            }
          >
            {/* MUI exige al menos un hijo en un select: sin equipo elegido o sin integrantes va uno deshabilitado */}
            {miembrosDelEquipo.length === 0 ? (
              <MenuItem value="" disabled>
                Sin integrantes disponibles
              </MenuItem>
            ) : null}
            {miembrosDelEquipo.map((cuenta) => (
              <MenuItem key={cuenta.id} value={cuenta.id}>
                {cuenta.nombre} · {cuenta.rolNombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            key={ministerioDelEquipo ?? 'sin-equipo'}
            name="eventoId"
            label="Para qué evento (opcional)"
            defaultValue=""
            helperText={
              ministerioDelEquipo == null
                ? 'Elige primero el equipo.'
                : eventosDelEquipo.length === 0
                  ? 'No hay eventos próximos en este ministerio.'
                  : 'Así se ve en el evento qué equipo salió para él.'
            }
          >
            <MenuItem value="">Sin evento</MenuItem>
            {eventosDelEquipo.map((evento) => (
              <MenuItem key={evento.id} value={evento.id}>
                {evento.nombre} · {formatearFecha(evento.fecha)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            name="entregado"
            label="¿Ya se lo llevó?"
            defaultValue="on"
            helperText="Si lo recogerá después, queda «por recoger» hasta que él mismo confirme."
          >
            <MenuItem value="on">Sí, ya se lo lleva</MenuItem>
            {/* Valor «no» y no vacío: un valor vacío se pinta como campo sin elegir */}
            <MenuItem value="no">No, lo va a recoger</MenuItem>
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
