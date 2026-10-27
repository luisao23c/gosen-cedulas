'use client'

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ChecklistIcon from '@mui/icons-material/ChecklistOutlined'
import { useState, useTransition } from 'react'
import { consultarPaseDeListaAccion, guardarPaseDeListaAccion } from '@/features/asistencia/acciones'
import {
  ESTADOS_ASISTENCIA,
  ETIQUETAS_ASISTENCIA,
  ETIQUETAS_SITUACION,
  type Asistencia,
  type EstadoAsistencia,
  type SituacionIntegrante,
} from '@/types/domain'
import { formatearFechaConDia } from '@/lib/fechas'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/** Integrante listado para pasar lista: solo lo que la fila necesita. */
export interface IntegranteParaLista {
  id: number
  nombre: string
  situacion: SituacionIntegrante
}

/**
 * Pase de lista de la célula: el día que le toca reunirse se marca, uno por uno,
 * quién llegó. Cada día tiene su propio registro (una reunión por célula y
 * fecha), así que se puede ver la fecha que toca y adelantar o repasar otra.
 *
 * El formulario vive en un diálogo (pantalla completa en móvil) con el estado
 * común de `useFormularioDialogo`; las marcas se hacen en el cliente y viajan
 * como `estado_<id>` dentro del FormData.
 *
 * Nota: aquí NO se usa `AccionPrincipal` (botón + FAB) porque la ficha de la
 * célula ya tiene su propia acción flotante («Nuevo integrante») y dos FAB se
 * encimarían en el mismo punto en móvil. Va un botón de tamaño táctil.
 */
export default function PaseDeLista({
  celulaId,
  integrantes,
  fechaInicial,
  asistenciasIniciales,
  hayRegistroInicial,
  hoyToca,
  diaSemanaTexto,
  puedePasarLista,
}: {
  celulaId: number
  integrantes: IntegranteParaLista[]
  /** La fecha de la reunión que toca (hoy si es su día; si no, la última que pasó) */
  fechaInicial: string
  asistenciasIniciales: Asistencia[]
  hayRegistroInicial: boolean
  /** Hoy es el día de reunión de esta célula */
  hoyToca: boolean
  /** «Miércoles · 19:00», para explicar por qué esa fecha */
  diaSemanaTexto: string | null
  puedePasarLista: boolean
}) {
  const [fecha, setFecha] = useState(fechaInicial)
  const [marcas, setMarcas] = useState<Record<number, EstadoAsistencia>>(() =>
    Object.fromEntries(asistenciasIniciales.map((asistencia) => [asistencia.integranteId, asistencia.estado])),
  )
  const [hayRegistro, setHayRegistro] = useState(hayRegistroInicial)
  const [avisoFecha, setAvisoFecha] = useState<string | null>(null)
  const [cambiando, iniciarCambio] = useTransition()

  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    guardarPaseDeListaAccion,
    'Pase de lista guardado',
    () => setHayRegistro(true),
  )

  /** Sin marca, el integrante cuenta como presente: solo se cambia a quien falló. */
  const estadoDe = (integranteId: number): EstadoAsistencia => marcas[integranteId] ?? 'PRESENTE'

  const resumen = (() => {
    const conteo = new Map<EstadoAsistencia, number>()
    for (const integrante of integrantes) {
      const estado = estadoDe(integrante.id)
      conteo.set(estado, (conteo.get(estado) ?? 0) + 1)
    }
    return ESTADOS_ASISTENCIA.filter((estado) => (conteo.get(estado) ?? 0) > 0)
      .map((estado) => `${conteo.get(estado)} ${ETIQUETAS_ASISTENCIA[estado].toLowerCase()}`)
      .join(' · ')
  })()

  /** Cambiar de fecha trae lo que ya estaba registrado ese día. */
  const cambiarFecha = (nueva: string) => {
    setFecha(nueva)
    setAvisoFecha(null)
    iniciarCambio(async () => {
      const resultado = await consultarPaseDeListaAccion({ celulaId, fecha: nueva })
      if (!resultado.ok) {
        setAvisoFecha(resultado.error)
        return
      }
      setMarcas(
        Object.fromEntries(resultado.asistencias.map((asistencia) => [asistencia.integranteId, asistencia.estado])),
      )
      setHayRegistro(resultado.reunionId != null)
    })
  }

  return (
    <>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <ChecklistIcon fontSize="small" color="primary" />
                <Typography variant="overline" color="text.secondary">
                  Pase de lista
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatearFechaConDia(fecha)}
                {hoyToca && fecha === fechaInicial ? ' · hoy' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {integrantes.length === 0
                  ? 'Esta célula todavía no tiene integrantes a quienes pasar lista.'
                  : hayRegistro
                    ? `Registrado: ${resumen}`
                    : 'Sin pase de lista este día. Vienen marcados como presentes: cambia solo a quien no llegó.'}
              </Typography>
            </Box>
            {puedePasarLista && integrantes.length > 0 ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<ChecklistIcon />}
                onClick={abrir}
                sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
              >
                Pasar lista
              </Button>
            ) : null}
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}
          >
            <TextField
              label="Fecha de la reunión"
              type="date"
              size="small"
              value={fecha}
              onChange={(evento) => cambiarFecha(evento.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: '2999-12-31' } }}
            />
            {hoyToca ? (
              <Chip color="success" size="small" label="Hoy toca reunión" />
            ) : diaSemanaTexto ? (
              <Chip size="small" variant="outlined" label={diaSemanaTexto} />
            ) : null}
            {cambiando ? <CircularProgress size={16} aria-label="Buscando el pase de ese día" /> : null}
          </Stack>

          {avisoFecha ? <Alert severity="warning">{avisoFecha}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </Paper>

      <DialogoFormulario
        abierto={abierto}
        titulo={`Pase de lista · ${formatearFechaConDia(fecha)}`}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
        anchoMaximo="sm"
      >
        <Stack spacing={1}>
          <input type="hidden" name="celulaId" value={celulaId} readOnly />
          <input type="hidden" name="fecha" value={fecha} readOnly />

          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography variant="body2" color="text.secondary">
              {integrantes.length} {integrantes.length === 1 ? 'integrante' : 'integrantes'}
            </Typography>
            <Button
              size="small"
              onClick={() =>
                setMarcas(
                  Object.fromEntries(integrantes.map((integrante) => [integrante.id, 'PRESENTE' as const])),
                )
              }
            >
              Marcar todos presentes
            </Button>
          </Stack>

          <Divider />

          {integrantes.map((integrante) => (
            <Stack
              key={integrante.id}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {integrante.nombre}
                </Typography>
                {integrante.situacion !== 'ACTIVO' ? (
                  <Typography variant="caption" color="text.secondary">
                    {ETIQUETAS_SITUACION[integrante.situacion]}
                  </Typography>
                ) : null}
              </Box>
              <Select
                size="small"
                value={estadoDe(integrante.id)}
                onChange={(evento) =>
                  setMarcas((anteriores) => ({
                    ...anteriores,
                    [integrante.id]: evento.target.value as EstadoAsistencia,
                  }))
                }
                inputProps={{ 'aria-label': `Asistencia de ${integrante.nombre}` }}
                sx={{ minWidth: 148, flexShrink: 0 }}
              >
                {ESTADOS_ASISTENCIA.map((estado) => (
                  <MenuItem key={estado} value={estado}>
                    {ETIQUETAS_ASISTENCIA[estado]}
                  </MenuItem>
                ))}
              </Select>
              {/* El estado viaja como `estado_<id>`; el servidor lo valida y
                  comprueba que el integrante sí pertenece a esta célula. */}
              <input type="hidden" name={`estado_${integrante.id}`} value={estadoDe(integrante.id)} readOnly />
            </Stack>
          ))}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
