'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import PlaceIcon from '@mui/icons-material/PlaceOutlined'
import CheckIcon from '@mui/icons-material/CheckOutlined'
import CloseIcon from '@mui/icons-material/CloseOutlined'
import HowToRegIcon from '@mui/icons-material/HowToRegOutlined'
import { guardarIntegrante } from '@/features/integrantes/acciones'
import { ESTADO_INICIAL } from '@/features/tipos'
import { nombreCompleto } from '@/types/domain'
import CamposIntegrante from '@/components/CamposIntegrante'
import CamposDiferenciadores from '@/components/CamposDiferenciadores'
import { useAviso } from '@/components/AvisoProvider'
import type { UbicacionMarcada } from '@/components/CampoUbicacion'
import { coordenadasDe, distanciaKm, distanciaLegible } from '@/lib/geo'
import {
  compararCandidatas,
  evaluarCandidata,
  porIdCampos,
  porIdRespuestas,
  puntuarCandidata,
} from '@/lib/campos'
import type { CampoDiferenciador, CriterioCelula, RespuestaCampo } from '@/types/domain'

/** Célula tal como la necesita el registro: con su punto, su horario y lo que acepta. */
export interface CelulaCercana {
  id: number
  nombre: string
  rama: string
  /** «Miércoles · 19:00» o «Sin día fijo» */
  reunion: string
  latitud: number | null
  longitud: number | null
  direccion: string | null
  /** A quién le sirve esta célula (vacío = se recomienda solo por cercanía) */
  criterios: CriterioCelula[]
}

/** Lo que la persona respondió en los campos del catálogo, leído del formulario. */
function respuestasDelFormulario(
  formulario: HTMLFormElement,
  campos: CampoDiferenciador[],
): RespuestaCampo[] {
  const datos = new FormData(formulario)
  const respuestas: RespuestaCampo[] = []
  for (const campo of campos) {
    const crudo = datos.get(`respuesta_${campo.id}`)
    const texto = crudo == null ? '' : String(crudo).trim()
    if (texto === '') continue
    if (campo.tipo === 'SELECT') {
      respuestas.push({ campoId: campo.id, opcionId: Number(texto), valor: null })
    } else {
      respuestas.push({ campoId: campo.id, opcionId: null, valor: Number(texto) })
    }
  }
  return respuestas
}

const SIN_UBICACION: UbicacionMarcada = { latitud: null, longitud: null, direccion: null }

/**
 * Registro de personas nuevas por ubicación (rol Lobby).
 *
 * El orden manda: primero se marca en el mapa dónde vive la persona, y con ese
 * punto se ordenan las células por cercanía. Quien registra elige una —por
 * defecto la más cercana— y completa los datos. Al guardar, el formulario se
 * vacía para poder atender a la siguiente persona sin salir de la pantalla.
 */
export default function RegistroLobby({
  celulas,
  campos,
}: {
  celulas: CelulaCercana[]
  /** Catálogo activo de campos diferenciadores (vacío = registro de siempre) */
  campos: CampoDiferenciador[]
}) {
  const router = useRouter()
  const avisar = useAviso()
  const formulario = React.useRef<HTMLFormElement>(null)
  const [ubicacion, setUbicacion] = React.useState<UbicacionMarcada>(SIN_UBICACION)
  // Lo que va contestando la persona: con esto se recomienda la célula
  const [respuestas, setRespuestas] = React.useState<RespuestaCampo[]>([])
  // La elección manual se guarda junto al punto con el que se hizo: si el punto
  // cambia, deja de valer y vuelve a proponerse la célula más cercana.
  const [eleccion, setEleccion] = React.useState<{ punto: string; id: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [registrado, setRegistrado] = React.useState<string | null>(null)
  const [pendiente, iniciar] = React.useTransition()
  // Cambiar la clave vuelve a montar los campos (y el mapa) en blanco
  const [clave, setClave] = React.useState(0)

  const punto = React.useMemo(() => coordenadasDe(ubicacion), [ubicacion])

  /** ¿La persona ya contestó algún campo? Sin respuestas, los criterios no pueden juzgar nada. */
  const hayRespuestas = respuestas.length > 0

  /**
   * RANKING de células para esta persona, de la que mejor le queda a la que peor.
   *
   * Cada célula recibe un puntaje de 0 a 100 que mezcla qué tantos criterios cumple
   * (70 %) y qué tan cerca está (30 %) —ver `puntuarCandidata` en lib/campos.ts—.
   * Las que fallan un criterio obligatorio van después de las que sí cumplen.
   * Lo que nadie contestó no cuenta como cumplido.
   */
  const ordenadas = React.useMemo(() => {
    const camposPorId = porIdCampos(campos)
    const respuestasPorId = porIdRespuestas(respuestas)
    return celulas
      .map((celula) => {
        const suyo = coordenadasDe(celula)
        const distancia = punto && suyo ? distanciaKm(punto, suyo) : null
        const evaluacion =
          celula.criterios.length > 0
            ? evaluarCandidata(celula.criterios, camposPorId, respuestasPorId)
            : undefined
        return {
          celula,
          distancia,
          evaluacion,
          puntaje: puntuarCandidata(evaluacion, distancia, hayRespuestas),
        }
      })
      .sort((a, b) => compararCandidatas(a, b, hayRespuestas))
  }, [celulas, campos, respuestas, punto, hayRespuestas])

  /** ¿Alguna célula cumple todo lo obligatorio? Decide si se separan los grupos. */
  const hayAptas = hayRespuestas && ordenadas.some((entrada) => entrada.evaluacion?.apta ?? false)

  /** La mejor del ranking que de verdad le sirve; si ninguna, la primera con ubicación. */
  const recomendada =
    ordenadas.find((entrada) => !hayRespuestas || !entrada.evaluacion || entrada.evaluacion.apta)
      ?.celula.id ?? ordenadas[0]?.celula.id

  // La recomendación se propone sola; la elección manual manda mientras el punto
  // (y lo contestado) siga siendo lo mismo.
  const sugerida = recomendada
  const clavePunto = punto ? `${punto.latitud},${punto.longitud}` : null
  // `clavePunto` es null cuando todavía no hay punto: la elección manual vale igual
  const elegida = eleccion && eleccion.punto === (clavePunto ?? '') ? eleccion.id : sugerida

  /**
   * Lee las respuestas mientras se escriben. Solo cambia el estado cuando una
   * respuesta de verdad cambió: escribir el nombre o el teléfono no debe mover
   * la lista de células.
   */
  const actualizarRespuestas = () => {
    if (!formulario.current) return
    const nuevas = respuestasDelFormulario(formulario.current, campos)
    setRespuestas((previas) => {
      if (JSON.stringify(previas) === JSON.stringify(nuevas)) return previas
      // Otra respuesta = otra recomendación: la elección manual deja de valer
      setEleccion(null)
      return nuevas
    })
  }

  const enviar = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const datos = new FormData(formulario)

    iniciar(async () => {
      const resultado = await guardarIntegrante(ESTADO_INICIAL, datos)
      if (resultado?.error) {
        setError(resultado.error)
        setRegistrado(null)
        return
      }

      const persona = nombreCompleto({
        nombre: String(datos.get('nombre') ?? ''),
        apellidoPaterno: String(datos.get('apellidoPaterno') ?? ''),
        apellidoMaterno: (datos.get('apellidoMaterno') as string | null) || null,
      })
      const destino = celulas.find((celula) => celula.id === elegida)

      setError(null)
      setRegistrado(destino ? `${persona} quedó en ${destino.nombre} (${destino.rama}).` : persona)
      setUbicacion(SIN_UBICACION)
      setEleccion(null)
      setRespuestas([])
      setClave((n) => n + 1)
      avisar('Integrante registrado')
      router.refresh()
    })
  }

  return (
    <Box component="form" ref={formulario} onSubmit={enviar} onChange={actualizarRespuestas} noValidate>
      <Stack spacing={3}>
        {error ? <Alert severity="error">{error}</Alert> : null}

        {registrado ? (
          <Alert severity="success">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {registrado}
            </Typography>
            <Typography variant="caption">
              El formulario quedó limpio para registrar a la siguiente persona.
            </Typography>
          </Alert>
        ) : null}

        <CamposIntegrante
          key={clave}
          autoenfocarNombre={false}
          alCambiarUbicacion={setUbicacion}
          despuesDeUbicacion={
            <Box>
              {campos.length > 0 ? (
                <Box sx={{ mb: 3 }}>
                  <CamposDiferenciadores
                    key={clave}
                    campos={campos}
                    descripcion="Lo que contestes aquí decide qué célula se recomienda (puedes dejar en blanco lo que no sepas)."
                    // El control ya escribió su valor: se lee en el siguiente cuadro
                    alResponder={() => window.requestAnimationFrame(actualizarRespuestas)}
                  />
                </Box>
              ) : null}

              <Typography variant="overline" color="text.secondary">
                {campos.length > 0 ? 'Célula que mejor le sirve' : 'Célula más cercana'}
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              {ordenadas.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hay células activas a tu alcance.
                </Typography>
              ) : (
                <>
                  {!punto ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {respuestas.length > 0
                        ? 'Sin el punto en el mapa no se puede medir la distancia: el orden de abajo sale de las respuestas.'
                        : 'Marca el punto en el mapa o contesta las preguntas de arriba: con eso se ordenan las células.'}
                    </Typography>
                  ) : null}
                <RadioGroup
                  name="celulaElegida"
                  value={elegida ?? ''}
                  onChange={(evento) => {
                    setEleccion({ punto: clavePunto ?? '', id: Number(evento.target.value) })
                    setRegistrado(null)
                  }}
                >
                  <Stack spacing={1}>
                    {ordenadas.map(({ celula, distancia, evaluacion, puntaje }, indice) => (
                      <React.Fragment key={celula.id}>
                      {/* Separador: primero las que cumplen, después las demás */}
                      {hayAptas &&
                      (evaluacion?.apta ?? false) &&
                      !(ordenadas[indice - 1]?.evaluacion?.apta ?? false) ? (
                        <Typography variant="overline" color="success.main">
                          Le sirven a esta persona
                        </Typography>
                      ) : null}
                      {hayAptas &&
                      !(evaluacion?.apta ?? false) &&
                      (ordenadas[indice - 1]?.evaluacion?.apta ?? false) ? (
                        <Typography variant="overline" color="text.secondary" sx={{ pt: 1 }}>
                          Otras células a tu alcance
                        </Typography>
                      ) : null}
                      <Paper
                        variant="outlined"
                        sx={{
                          px: 1.5,
                          py: 1,
                          borderColor: elegida === celula.id ? 'primary.main' : 'divider',
                        }}
                      >
                        <FormControlLabel
                          value={celula.id}
                          control={<Radio size="small" />}
                          sx={{ width: '100%', m: 0, alignItems: 'flex-start' }}
                          label={
                            <Box sx={{ display: 'flex', gap: 1.5, width: '100%', pt: 0.5 }}>
                              {/* Posición en el ranking: 1 es la que mejor le queda */}
                              <Box
                                aria-label={`Lugar ${indice + 1} del ranking`}
                                sx={{
                                  flexShrink: 0,
                                  display: 'grid',
                                  placeItems: 'center',
                                  width: 28,
                                  height: 28,
                                  mt: 0.25,
                                  borderRadius: '50%',
                                  bgcolor: indice === 0 ? 'primary.main' : 'action.selected',
                                  color: indice === 0 ? 'primary.contrastText' : 'text.secondary',
                                  typography: 'caption',
                                  fontWeight: 700,
                                }}
                              >
                                {indice + 1}
                              </Box>

                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 120 }}>
                                    {celula.nombre}
                                  </Typography>
                                  {distancia != null ? (
                                    <Chip
                                      size="small"
                                      icon={<PlaceIcon />}
                                      label={distanciaLegible(distancia)}
                                    />
                                  ) : (
                                    <Chip size="small" variant="outlined" label="Sin ubicación" />
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {celula.rama} · {celula.reunion}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {celula.direccion ?? 'Sin dirección registrada'}
                                </Typography>

                                {/* Cuánto le queda: criterios + cercanía en una sola barra */}
                                {hayRespuestas || punto ? (
                                  <Box sx={{ mt: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        {recomendada === celula.id ? 'La que mejor le sirve' : 'Coincidencia'}
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                        {puntaje.puntaje} %
                                      </Typography>
                                    </Box>
                                    <LinearProgress
                                      variant="determinate"
                                      value={puntaje.puntaje}
                                      color={
                                        !(evaluacion?.apta ?? true) && hayRespuestas
                                          ? 'warning'
                                          : puntaje.puntaje >= 70
                                            ? 'success'
                                            : 'primary'
                                      }
                                      aria-label={`Coincidencia de ${celula.nombre}: ${puntaje.puntaje} por ciento`}
                                    />
                                  </Box>
                                ) : null}

                                {/* El porqué: qué cumple (✓) y qué le falta (✗), no solo «cumple 2 de 3» */}
                                {evaluacion && hayRespuestas ? (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                    {evaluacion.cumplidos.map((motivo) => (
                                      <Chip
                                        key={`ok-${motivo}`}
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                        icon={<CheckIcon />}
                                        label={motivo}
                                      />
                                    ))}
                                    {evaluacion.faltantes.map((motivo) => (
                                      <Chip
                                        key={`falta-${motivo}`}
                                        size="small"
                                        color={evaluacion.faltantesObligatorios.includes(motivo) ? 'error' : 'default'}
                                        variant="outlined"
                                        icon={<CloseIcon />}
                                        label={
                                          evaluacion.faltantesObligatorios.includes(motivo)
                                            ? `Obligatorio: ${motivo}`
                                            : motivo
                                        }
                                      />
                                    ))}
                                  </Box>
                                ) : evaluacion ? (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    Contesta los campos de arriba para ver cuáles cumple.
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    Sin criterios: recibe a cualquier persona.
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          }
                        />
                      </Paper>
                      </React.Fragment>
                    ))}
                  </Stack>
                </RadioGroup>
                </>
              )}

              <input type="hidden" name="celulaId" value={elegida ?? ''} readOnly />
            </Box>
          }
        />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'flex-end' }}
        >
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pendiente}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
            startIcon={
              pendiente ? <CircularProgress size={16} color="inherit" /> : <HowToRegIcon />
            }
          >
            {pendiente ? 'Guardando…' : 'Registrar integrante'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
