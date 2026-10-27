'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import MyLocationIcon from '@mui/icons-material/MyLocationOutlined'
import LoginIcon from '@mui/icons-material/LoginOutlined'
import ReplayIcon from '@mui/icons-material/ReplayOutlined'
import { marcarLlegada } from '@/features/ministerio/eventos'
import { ESTADO_INICIAL } from '@/features/tipos'
import { formatearFechaConDia } from '@/lib/fechas'
import { useAviso } from '@/components/AvisoProvider'
import DialogoFormulario from '@/components/DialogoFormulario'
import { distanciaKm, distanciaLegible, redondearCoordenada } from '@/lib/geo'
import { etiquetaLlegada, tonoDeLlegada } from '@/lib/servicio'

interface Punto {
  latitud: number
  longitud: number
}

/**
 * Tiempo máximo que se espera la ubicación del teléfono. El sistema solo lo
 * respeta cuando el permiso ya está decidido: mientras el aviso del navegador
 * está abierto la espera no termina, así que el tope lo pone la app.
 */
const TIEMPO_UBICACION_MS = 12000

/** Hora local actual en el formato de `datetime-local` (sin pasar por UTC). */
function ahoraLocal(): string {
  const ahora = new Date()
  const dos = (numero: number) => String(numero).padStart(2, '0')
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}T${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`
}

/**
 * Marcar la hora de llegada a un evento.
 *
 * El camino de cada servidor es un toque: se toma la ubicación del teléfono y
 * se guarda la hora con el punto donde checó. El encargado del ministerio tiene
 * además un diálogo para marcar por alguien que no trae teléfono, con la hora
 * escrita a mano; quien registra por otro queda anotado como tal.
 *
 * La dirección nunca bloquea: si el servicio de direcciones no responde, las
 * coordenadas se guardan igual y la distancia al punto del evento se calcula
 * aquí mismo, contra el punto donde tienen que estar.
 */
export default function AccionLlegada({
  eventoId,
  usuarioId,
  nombreServidor,
  fechaEvento,
  horaLlegada,
  puntoEvento,
  llegoEn,
  variante = 'grande',
}: {
  eventoId: number
  /** Vacío = mi propio turno; con valor, el encargado marca por esa persona */
  usuarioId?: number
  nombreServidor?: string | null
  fechaEvento: string
  horaLlegada: string | null
  puntoEvento?: Punto | null
  /** Si ya hay llegada registrada (para mostrarla y permitir volver a marcar) */
  llegoEn?: string | null
  /**
   *  · `grande` (por defecto): botón ancho + el estado de la llegada. Para la
   *    pantalla «Mis turnos».
   *  · `icono`: solo la acción, para la fila de un listado (el detalle ya lo
   *    pinta la fila). Si hay `usuarioId`, abre el diálogo del encargado.
   */
  variante?: 'grande' | 'icono'
}) {
  const router = useRouter()
  const avisar = useAviso()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [punto, setPunto] = useState<Punto | null>(null)

  /** Ubicación del dispositivo. Nunca lanza: devuelve null y quien llama avisa. */
  const tomarUbicacion = (): Promise<Punto | null> =>
    new Promise((resolver) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolver(null)
        return
      }

      let terminado = false
      const terminar = (punto: Punto | null) => {
        if (terminado) return
        terminado = true
        clearTimeout(reloj)
        resolver(punto)
      }
      // El tope lo marca la app: si el navegador se queda esperando permiso,
      // el botón no puede quedarse girando para siempre.
      const reloj = setTimeout(() => terminar(null), TIEMPO_UBICACION_MS)

      navigator.geolocation.getCurrentPosition(
        (posicion) =>
          terminar({
            latitud: redondearCoordenada(posicion.coords.latitude),
            longitud: redondearCoordenada(posicion.coords.longitude),
          }),
        () => terminar(null),
        { enableHighAccuracy: true, timeout: TIEMPO_UBICACION_MS - 500, maximumAge: 0 },
      )
    })

  const mensajeSinUbicacion =
    'No pudimos leer tu ubicación. Revisa los permisos del navegador y vuelve a intentar. (Necesita https o localhost.)'

  const enviar = (datos: FormData, distancia: number | null) => {
    setError(null)
    iniciar(async () => {
      const resultado = await marcarLlegada(ESTADO_INICIAL, datos)
      if (resultado.error) {
        setError(resultado.error)
        return
      }
      setAbierto(false)
      avisar(
        distancia != null
          ? `Llegada registrada · a ${distanciaLegible(distancia)} del punto`
          : 'Llegada registrada',
      )
      router.refresh()
    })
  }

  /** Toma la ubicación y guarda la llegada con la hora actual. */
  const marcarAhora = async () => {
    setAviso(null)
    setError(null)
    setBuscando(true)
    const ubicacion = await tomarUbicacion()
    setBuscando(false)
    if (!ubicacion) {
      setAviso(mensajeSinUbicacion)
      return
    }
    const datos = new FormData()
    datos.set('eventoId', String(eventoId))
    if (usuarioId != null) datos.set('usuarioId', String(usuarioId))
    datos.set('latitud', String(ubicacion.latitud))
    datos.set('longitud', String(ubicacion.longitud))
    enviar(datos, puntoEvento ? distanciaKm(ubicacion, puntoEvento) : null)
  }

  /** Diálogo del encargado: manda la hora escrita y, si la toma, su ubicación. */
  const enviarDialogo = (datos: FormData) => {
    enviar(datos, punto != null && puntoEvento ? distanciaKm(punto, puntoEvento) : null)
  }

  const tomarUbicacionEnDialogo = async () => {
    setAviso(null)
    setBuscando(true)
    const ubicacion = await tomarUbicacion()
    setBuscando(false)
    if (!ubicacion) {
      setAviso(mensajeSinUbicacion)
      return
    }
    setPunto(ubicacion)
  }

  const resumen = llegoEn ? etiquetaLlegada(llegoEn, fechaEvento, horaLlegada) : null
  const tono = tonoDeLlegada(llegoEn, fechaEvento, horaLlegada)
  const ocupado = buscando || pendiente

  /* ── El encargado marca por otra persona: diálogo con la hora ── */
  if (variante === 'icono' && usuarioId != null) {
    return (
      <>
        <Tooltip title={resumen ? `Llegada: ${resumen}` : 'Marcar llegada'}>
          <IconButton
            color={llegoEn ? 'success' : 'primary'}
            onClick={() => {
              setPunto(null)
              setAviso(null)
              setError(null)
              setAbierto(true)
            }}
            aria-label={resumen ? `Llegada: ${resumen}` : 'Marcar llegada'}
          >
            {llegoEn ? <ReplayIcon fontSize="small" /> : <LoginIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <DialogoFormulario
          abierto={abierto}
          titulo={llegoEn ? 'Corregir la llegada' : 'Marcar la llegada'}
          descripcion={nombreServidor ?? undefined}
          etiquetaGuardar="Guardar llegada"
          alCerrar={() => setAbierto(false)}
          alEnviar={enviarDialogo}
          pendiente={pendiente}
          error={error}
        >
          <Stack spacing={2} sx={{ mt: 1 }}>
            <input type="hidden" name="eventoId" value={eventoId} />
            {usuarioId != null ? <input type="hidden" name="usuarioId" value={usuarioId} /> : null}
            <input type="hidden" name="latitud" value={punto ? String(punto.latitud) : ''} />
            <input type="hidden" name="longitud" value={punto ? String(punto.longitud) : ''} />

            <TextField
              name="llegoEn"
              label="Hora a la que llegó"
              type="datetime-local"
              defaultValue={llegoEn ? llegoEn.slice(0, 16) : ahoraLocal()}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText={`El evento es el ${formatearFechaConDia(fechaEvento)}${horaLlegada ? ` y la hora de llegada era ${horaLlegada}` : ''}.`}
            />

            <Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  buscando ? <CircularProgress size={14} color="inherit" /> : <MyLocationIcon />
                }
                onClick={tomarUbicacionEnDialogo}
                disabled={buscando}
              >
                {buscando ? 'Buscando…' : 'Usar mi ubicación'}
              </Button>
              {punto ? (
                <Chip
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                  label={`${punto.latitud.toFixed(5)}, ${punto.longitud.toFixed(5)}`}
                />
              ) : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.75 }}
                >
                  Sin ubicación: se guarda solo la hora.
                </Typography>
              )}
            </Box>

            {aviso ? <Alert severity="warning">{aviso}</Alert> : null}
          </Stack>
        </DialogoFormulario>
      </>
    )
  }

  /* ── Mi propio turno, en la fila de un listado: solo el icono ── */
  if (variante === 'icono') {
    return (
      <>
        <Tooltip title={resumen ? `Llegada: ${resumen}` : 'Marcar mi llegada'}>
          <span>
            <IconButton
              color={llegoEn ? 'success' : 'primary'}
              onClick={marcarAhora}
              disabled={ocupado}
              aria-label={resumen ? `Llegada: ${resumen}` : 'Marcar mi llegada'}
            >
              {ocupado ? (
                <CircularProgress size={18} color="inherit" />
              ) : llegoEn ? (
                <ReplayIcon fontSize="small" />
              ) : (
                <LoginIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
        {aviso ? <Alert severity="warning">{aviso}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
      </>
    )
  }

  /* ── Mi propio turno, con espacio: botón grande y estado ── */
  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      {resumen ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip size="small" color={tono} label={resumen} />
          <Button
            size="small"
            startIcon={ocupado ? <CircularProgress size={14} color="inherit" /> : <MyLocationIcon />}
            onClick={marcarAhora}
            disabled={ocupado}
          >
            Volver a marcar
          </Button>
        </Stack>
      ) : (
        <Button
          variant="contained"
          size="large"
          startIcon={ocupado ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
          onClick={marcarAhora}
          disabled={ocupado}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {buscando ? 'Ubicando…' : pendiente ? 'Guardando…' : 'Marcar mi llegada'}
        </Button>
      )}

      {aviso ? <Alert severity="warning">{aviso}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  )
}
