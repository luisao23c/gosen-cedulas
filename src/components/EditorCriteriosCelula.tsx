'use client'

import { useState } from 'react'
import { Box, Checkbox, Divider, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import type { CampoDiferenciador, CriterioCelula } from '@/types/domain'
import { radios } from '@/theme/theme'

/** Lo que se edita de un campo (todo controlado: MUI avisa de los cambios). */
interface Borrador {
  obligatorio: boolean
  opciones: number[]
  minimo: string
  maximo: string
}

function borradorDe(criterio: CriterioCelula | undefined): Borrador {
  return {
    obligatorio: criterio?.obligatorio ?? false,
    opciones: criterio?.opcionIds ?? [],
    minimo: criterio?.minimo != null ? String(criterio.minimo) : '',
    maximo: criterio?.maximo != null ? String(criterio.maximo) : '',
  }
}

/**
 * ★ EDITOR DE CRITERIOS (se usa en dos sitios) ★
 *
 *  · Dentro del diálogo de «Nueva célula» / «Editar célula», para declararlos
 *    en el mismo momento en que se da de alta la célula.
 *  · Dentro de la tarjeta «A quién le sirve» de la ficha de la célula.
 *
 * Marca las preguntas del catálogo que la célula acepta, si son **obligatorias**
 * (sin cumplirlas no se recomienda) o **preferencias** (suman al recomendarla) y
 * con qué opciones o rango. El rango se valida en el servidor contra los
 * límites del campo: no se puede pedir «de 10 a 200 años» en un campo que solo
 * admite 0 a 120.
 *
 * El estado vive AQUÍ, dentro del diálogo: al cerrarlo se desmonta el contenido
 * y al volver a abrirlo el editor arranca de vuelta con `criterios`.
 *
 * Viaja al servidor como:
 *  · `conCriterios = 1`            → «el formulario trae criterios» (si está
 *                                    ausente, guardar no toca los existentes)
 *  · `campo = id` (uno por marcado) → qué preguntas se piden
 *  · `obligatorio_<id>`, `opcion_<id>`, `minimo_<id>`, `maximo_<id>`
 */
export default function EditorCriteriosCelula({
  campos,
  criterios,
  titulo = 'A quién le sirve (opcional)',
  descripcion = 'Con estas respuestas el registro de Lobby recomienda la célula y explica por qué. Lo obligatorio descarta; lo demás suma.',
}: {
  /** Catálogo activo de campos (lo que se puede pedir) */
  campos: CampoDiferenciador[]
  /** Lo que la célula acepta hoy (vacío al crear una nueva) */
  criterios: CriterioCelula[]
  titulo?: string
  descripcion?: string
}) {
  const iniciales = (): Record<number, Borrador> => {
    const mapa: Record<number, Borrador> = {}
    for (const campo of campos) {
      mapa[campo.id] = borradorDe(criterios.find((criterio) => criterio.campoId === campo.id))
    }
    return mapa
  }

  /** Campos marcados y lo elegido en cada uno */
  const [pedidos, setPedidos] = useState<number[]>(criterios.map((criterio) => criterio.campoId))
  const [borradores, setBorradores] = useState<Record<number, Borrador>>(iniciales)

  const cambiar = (campoId: number, cambios: Partial<Borrador>) => {
    setBorradores((previos) => ({
      ...previos,
      [campoId]: { ...(previos[campoId] ?? borradorDe(undefined)), ...cambios },
    }))
  }

  const alternar = (campoId: number) => {
    setPedidos((previos) =>
      previos.includes(campoId) ? previos.filter((id) => id !== campoId) : [...previos, campoId],
    )
  }

  const alternarOpcion = (campoId: number, opcionId: number) => {
    const actual = borradores[campoId] ?? borradorDe(undefined)
    cambiar(campoId, {
      opciones: actual.opciones.includes(opcionId)
        ? actual.opciones.filter((id) => id !== opcionId)
        : [...actual.opciones, opcionId],
    })
  }

  // Catálogo vacío: no hay nada que declarar y el formulario no cambia.
  if (campos.length === 0) return null

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {titulo}
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {descripcion}
      </Typography>

      <input type="hidden" name="conCriterios" value="1" />
      {/* Solo viajan los campos marcados: el servidor ignora el resto */}
      {pedidos.map((campoId) => (
        <input key={campoId} type="hidden" name="campo" value={campoId} />
      ))}

      <Stack spacing={2}>
        {campos.map((campo) => {
          const borrador = borradores[campo.id] ?? borradorDe(undefined)
          const activo = pedidos.includes(campo.id)

          return (
            <Box
              key={campo.id}
              sx={{
                p: 1.5,
                borderRadius: `${radios.medio}px`,
                border: '1px solid',
                borderColor: activo ? 'primary.main' : 'divider',
              }}
            >
              <FormControlLabel
                control={<Checkbox checked={activo} onChange={() => alternar(campo.id)} />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {campo.nombre}
                    </Typography>
                    {campo.descripcion ? (
                      <Typography variant="caption" color="text.secondary">
                        {campo.descripcion}
                      </Typography>
                    ) : null}
                  </Box>
                }
              />

              {activo ? (
                <Stack spacing={1.5} sx={{ pt: 1, pl: { xs: 0, sm: 1.5 } }}>
                  <FormControlLabel
                    control={
                      <Switch
                        name={`obligatorio_${campo.id}`}
                        checked={borrador.obligatorio}
                        onChange={(evento) => cambiar(campo.id, { obligatorio: evento.target.checked })}
                      />
                    }
                    label="Obligatorio (sin esto no se recomienda la célula)"
                  />

                  {campo.tipo === 'SELECT' ? (
                    <Box
                      sx={{ display: 'grid', gap: 0.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
                    >
                      {campo.opciones.map((opcion) => (
                        <FormControlLabel
                          key={opcion.id}
                          control={
                            <Checkbox
                              name={`opcion_${campo.id}`}
                              value={opcion.id}
                              size="small"
                              checked={borrador.opciones.includes(opcion.id)}
                              onChange={() => alternarOpcion(campo.id, opcion.id)}
                            />
                          }
                          label={opcion.etiqueta}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        name={`minimo_${campo.id}`}
                        label="Desde"
                        type="number"
                        value={borrador.minimo}
                        onChange={(evento) => cambiar(campo.id, { minimo: evento.target.value })}
                        helperText={campo.unidad ? `En ${campo.unidad}` : undefined}
                        slotProps={{
                          htmlInput: { min: campo.limiteInferior, max: campo.limiteSuperior },
                        }}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        name={`maximo_${campo.id}`}
                        label="Hasta"
                        type="number"
                        value={borrador.maximo}
                        onChange={(evento) => cambiar(campo.id, { maximo: evento.target.value })}
                        helperText={campo.unidad ? `En ${campo.unidad}` : undefined}
                        slotProps={{
                          htmlInput: { min: campo.limiteInferior, max: campo.limiteSuperior },
                        }}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                  )}
                </Stack>
              ) : null}
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
