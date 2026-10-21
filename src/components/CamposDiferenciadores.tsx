'use client'

import { Box, Divider, MenuItem, TextField, Typography } from '@mui/material'
import type { CampoDiferenciador, RespuestaCampo } from '@/types/domain'

/** Rejilla de dos columnas en escritorio, una en móvil (igual que CamposIntegrante). */
const rejilla = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
}

/** Etiqueta y ayuda de un campo RANGO («Edad (años)» · «Entre 0 y 120»). */
function rotuloDeRango(campo: CampoDiferenciador): { etiqueta: string; ayuda: string | null } {
  const etiqueta = campo.unidad ? `${campo.nombre} (${campo.unidad})` : campo.nombre
  if (campo.limiteInferior != null && campo.limiteSuperior != null) {
    return { etiqueta, ayuda: `Entre ${campo.limiteInferior} y ${campo.limiteSuperior}.` }
  }
  if (campo.limiteInferior != null) return { etiqueta, ayuda: `Desde ${campo.limiteInferior}.` }
  if (campo.limiteSuperior != null) return { etiqueta, ayuda: `Hasta ${campo.limiteSuperior}.` }
  return { etiqueta, ayuda: null }
}

/**
 * Controles para responder los campos diferenciadores («Estado civil», «Edad»…).
 *
 * Los pinta el registro por ubicación (Lobby) y la ficha del integrante: los
 * dos formularios comparten los nombres `respuesta_<campoId>`, que es lo que
 * lee el servidor en `features/campos/lectura.ts`. Si el catálogo está vacío no
 * se pinta nada y el formulario queda exactamente como estaba.
 */
export default function CamposDiferenciadores({
  campos,
  respuestas = [],
  titulo = 'Sobre la persona',
  descripcion,
  alResponder,
}: {
  campos: CampoDiferenciador[]
  /** Respuestas ya dadas (ficha del integrante); en Lobby se empieza vacío */
  respuestas?: RespuestaCampo[]
  titulo?: string
  descripcion?: string | null
  /**
   * Se llama cuando cambia una respuesta. Lobby lo usa para recomendar en
   * vivo: el cambio de un Select de MUI no llega al `onChange` del formulario,
   * así que hay que avisar desde aquí.
   */
  alResponder?: () => void
}) {
  if (campos.length === 0) return null
  const porCampo = new Map(respuestas.map((respuesta) => [respuesta.campoId, respuesta]))

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {titulo}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {descripcion ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          {descripcion}
        </Typography>
      ) : null}

      <Box sx={rejilla}>
        {campos.map((campo) => {
          const respuesta = porCampo.get(campo.id)

          if (campo.tipo === 'SELECT') {
            return (
              <TextField
                key={campo.id}
                select
                name={`respuesta_${campo.id}`}
                label={campo.nombre}
                defaultValue={respuesta?.opcionId ?? ''}
                helperText={campo.descripcion ?? undefined}
                onChange={alResponder}
                slotProps={{ inputLabel: { shrink: true } }}
              >
                <MenuItem value="">Sin responder</MenuItem>
                {campo.opciones.map((opcion) => (
                  <MenuItem key={opcion.id} value={opcion.id}>
                    {opcion.etiqueta}
                  </MenuItem>
                ))}
              </TextField>
            )
          }

          const { etiqueta, ayuda } = rotuloDeRango(campo)
          return (
            <TextField
              key={campo.id}
              name={`respuesta_${campo.id}`}
              label={etiqueta}
              type="number"
              defaultValue={respuesta?.valor ?? ''}
              onChange={alResponder}
              helperText={ayuda ?? campo.descripcion ?? undefined}
              slotProps={{ htmlInput: { min: campo.limiteInferior, max: campo.limiteSuperior } }}
            />
          )
        })}
      </Box>
    </Box>
  )
}
