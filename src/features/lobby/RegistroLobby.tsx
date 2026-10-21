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
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import PlaceIcon from '@mui/icons-material/Place'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import { guardarIntegrante } from '@/features/integrantes/acciones'
import { ESTADO_INICIAL } from '@/features/tipos'
import { nombreCompleto } from '@/types/domain'
import CamposIntegrante from '@/components/CamposIntegrante'
import CamposDiferenciadores from '@/components/CamposDiferenciadores'
import { useAviso } from '@/components/AvisoProvider'
import type { UbicacionMarcada } from '@/components/CampoUbicacion'
import { coordenadasDe, distanciaKm, distanciaLegible } from '@/lib/geo'
import {
  evaluarCandidata,
  ordenarPorEvaluacion,
  porIdCampos,
  porIdRespuestas,
  resumenDeEvaluacion,
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

  /**
   * Células ordenadas para recomendar: primero las que cumplen lo obligatorio,
   * después las que suman más preferencias y, a igualdad, la más cercana.
   * Lo que nadie contestó no cuenta como cumplido (ver lib/campos.ts).
   */
  const ordenadas = React.useMemo(() => {
    const camposPorId = porIdCampos(campos)
    const respuestasPorId = porIdRespuestas(respuestas)
    return celulas
      .map((celula) => {
        const suyo = coordenadasDe(celula)
        return {
          celula,
          distancia: punto && suyo ? distanciaKm(punto, suyo) : null,
          evaluacion:
            celula.criterios.length > 0
              ? evaluarCandidata(celula.criterios, camposPorId, respuestasPorId)
              : undefined,
        }
      })
      .sort((a, b) => {
        const porCriterios = ordenarPorEvaluacion(a.evaluacion, b.evaluacion)
        if (porCriterios !== 0) return porCriterios
        // Con el mismo puntaje, manda quien sí declaró criterios (está dicho a quién sirve)
        const conCriterios = (b.celula.criterios.length > 0 ? 1 : 0) - (a.celula.criterios.length > 0 ? 1 : 0)
        if (conCriterios !== 0) return conCriterios
        return (a.distancia ?? Number.POSITIVE_INFINITY) - (b.distancia ?? Number.POSITIVE_INFINITY)
      })
  }, [celulas, campos, respuestas, punto])

  /** ¿Alguna célula cumple todo lo obligatorio? Decide si se separan los grupos. */
  const hayAptas = ordenadas.some((entrada) => entrada.evaluacion?.apta ?? false)

  /** La primera apta con criterios declarados; si no hay, la más cercana. */
  const recomendada =
    ordenadas.find((entrada) => entrada.evaluacion?.apta && entrada.celula.criterios.length > 0)?.celula
      .id ?? ordenadas.find((entrada) => entrada.distancia != null)?.celula.id

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
                        : 'Marca el punto en el mapa o contesta los campos de arriba: con eso se ordenan las células.'}
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
                    {ordenadas.map(({ celula, distancia, evaluacion }, indice) => (
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
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 0.5 }}>
                              <Box sx={{ flex: 1, minWidth: 160 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {celula.nombre}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {celula.rama} · {celula.reunion}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {celula.direccion ?? 'Sin dirección registrada'}
                                </Typography>
                                {evaluacion ? (
                                  <Typography
                                    variant="caption"
                                    color={evaluacion.apta ? 'success.main' : 'text.secondary'}
                                    sx={{ display: 'block' }}
                                  >
                                    {[
                                      resumenDeEvaluacion(evaluacion),
                                      !evaluacion.apta && evaluacion.faltantes.length > 0
                                        ? `falta: ${evaluacion.faltantes.slice(0, 2).join(', ')}`
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </Typography>
                                ) : null}
                              </Box>
                              <Stack
                                direction="row"
                                spacing={0.5}
                                useFlexGap
                                sx={{ flexWrap: 'wrap', alignItems: 'center' }}
                              >
                                {distancia != null ? (
                                  <Chip
                                    size="small"
                                    color={indice === 0 ? 'primary' : 'default'}
                                    icon={<PlaceIcon />}
                                    label={distanciaLegible(distancia)}
                                  />
                                ) : (
                                  <Chip size="small" variant="outlined" label="Sin ubicación" />
                                )}
                                {recomendada === celula.id ? (
                                  <Chip size="small" color="success" label="La que mejor le sirve" />
                                ) : null}
                                {indice === 0 && distancia != null && recomendada !== celula.id ? (
                                  <Chip size="small" variant="outlined" label="La más cercana" />
                                ) : null}
                              </Stack>
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
