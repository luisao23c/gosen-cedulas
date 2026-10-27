'use client'

import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import MyLocationIcon from '@mui/icons-material/MyLocationOutlined'
import CloseIcon from '@mui/icons-material/CloseOutlined'
import SearchIcon from '@mui/icons-material/SearchOutlined'
import MapaUbicacion from '@/components/MapaUbicacion'
import { mapa } from '@/theme/theme'
import {
  buscarLugares,
  formatearCoordenadas,
  redondearCoordenada,
  resolverDireccion,
  type DireccionResuelta,
  type LugarEncontrado,
} from '@/lib/geo'

/** Punto marcado más la dirección que se obtuvo al marcarlo. */
export interface UbicacionMarcada {
  latitud: number | null
  longitud: number | null
  direccion: string | null
}

type Estado = 'inactivo' | 'buscando' | 'listo' | 'sinDireccion'

/** Nombres con los que los valores viajan en el FormData. */
const CAMPOS = { latitud: 'latitud', longitud: 'longitud', direccion: 'direccion' }

/**
 * Campo de ubicación: mapa + acción de geolocalización + dirección resuelta.
 *
 * Se usa igual en células e integrantes (AGENTS.md §3.5: la lógica se escribe
 * una vez). Los valores viajan como campos de formulario para no depender del
 * estado de React al guardar.
 */
export default function CampoUbicacion({
  etiqueta,
  ayuda,
  inicio,
  alCambiar,
}: {
  etiqueta: string
  ayuda: string
  /** Valores guardados, al editar */
  inicio?: UbicacionMarcada
  /** Cada vez que el punto o su dirección cambian (lo usa el registro por ubicación) */
  alCambiar?: (ubicacion: UbicacionMarcada) => void
}) {
  const [punto, setPunto] = React.useState<{ latitud: number; longitud: number } | null>(
    typeof inicio?.latitud === 'number' && typeof inicio?.longitud === 'number'
      ? { latitud: inicio.latitud, longitud: inicio.longitud }
      : null,
  )
  const [direccion, setDireccion] = React.useState<string | null>(inicio?.direccion ?? null)
  const [detalles, setDetalles] = React.useState<DireccionResuelta | null>(null)
  const [estado, setEstado] = React.useState<Estado>(inicio?.direccion ? 'listo' : 'inactivo')
  const [buscandoPosicion, setBuscandoPosicion] = React.useState(false)
  const [aviso, setAviso] = React.useState<string | null>(null)
  // Búsqueda por código postal, colonia o dirección
  const [consulta, setConsulta] = React.useState('')
  const [buscandoLugar, setBuscandoLugar] = React.useState(false)
  const [resultados, setResultados] = React.useState<LugarEncontrado[] | null>(null)
  const busquedaRef = React.useRef<AbortController | null>(null)

  const peticionRef = React.useRef<AbortController | null>(null)
  const alCambiarRef = React.useRef(alCambiar)

  // Mantiene a mano la última versión del aviso, sin renovar el efecto de abajo
  React.useEffect(() => {
    alCambiarRef.current = alCambiar
  }, [alCambiar])

  React.useEffect(
    () => () => {
      peticionRef.current?.abort()
      busquedaRef.current?.abort()
    },
    [],
  )

  React.useEffect(() => {
    alCambiarRef.current?.({
      latitud: punto?.latitud ?? null,
      longitud: punto?.longitud ?? null,
      direccion,
    })
  }, [punto, direccion])

  /** Pregunta al servicio de mapas por la dirección del punto marcado. */
  const resolver = async (latitud: number, longitud: number) => {
    peticionRef.current?.abort()
    const control = new AbortController()
    peticionRef.current = control

    setEstado('buscando')
    setDetalles(null)
    const resuelta = await resolverDireccion(latitud, longitud, control.signal)
    if (control.signal.aborted) return

    setDireccion(resuelta.direccion)
    setDetalles(resuelta)
    setEstado(resuelta.direccion ? 'listo' : 'sinDireccion')
  }

  const marcar = (latitud: number, longitud: number) => {
    setAviso(null)
    setPunto({ latitud, longitud })
    setDireccion(null)
    void resolver(latitud, longitud)
  }

  const quitar = () => {
    peticionRef.current?.abort()
    setPunto(null)
    setDireccion(null)
    setDetalles(null)
    setEstado('inactivo')
    setAviso(null)
    setConsulta('')
    setResultados(null)
  }

  /**
   * Busca por código postal, colonia o dirección y propone lugares. Con un solo
   * resultado (lo normal con un código postal) lo marca directo; con varios, deja
   * elegir. Después se puede afinar tocando el mapa.
   */
  const buscar = async () => {
    const texto = consulta.trim()
    if (texto.length < 3) {
      setAviso('Escribe al menos 3 caracteres: un código postal, una colonia o una calle.')
      return
    }
    busquedaRef.current?.abort()
    const control = new AbortController()
    busquedaRef.current = control

    setAviso(null)
    setResultados(null)
    setBuscandoLugar(true)
    const encontrados = await buscarLugares(texto, {
      pais: mapa.pais,
      centro: mapa.centro,
      senal: control.signal,
    })
    if (control.signal.aborted) return
    setBuscandoLugar(false)

    if (encontrados.length === 0) {
      setAviso(
        'No encontramos ese lugar. Revisa el código postal o prueba con la colonia y la ciudad; también puedes marcar el punto en el mapa.',
      )
      return
    }
    if (encontrados.length === 1) {
      elegirLugar(encontrados[0])
      return
    }
    setResultados(encontrados)
  }

  const elegirLugar = (lugar: LugarEncontrado) => {
    setResultados(null)
    setConsulta(lugar.etiqueta)
    marcar(lugar.latitud, lugar.longitud)
  }

  const usarMiUbicacion = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setAviso('Este dispositivo no ofrece su ubicación. Marca el punto en el mapa.')
      return
    }
    setBuscandoPosicion(true)
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setBuscandoPosicion(false)
        marcar(
          redondearCoordenada(posicion.coords.latitude),
          redondearCoordenada(posicion.coords.longitude),
        )
      },
      () => {
        setBuscandoPosicion(false)
        setAviso('No pudimos leer tu ubicación. Marca el punto en el mapa o revisa los permisos.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const coordenadas = punto
    ? formatearCoordenadas(punto.latitud, punto.longitud)
    : 'Sin marcar'
  const lugares = detalles
    ? [detalles.ciudad, detalles.estado, detalles.cp, detalles.pais].filter(
        (parte): parte is string => Boolean(parte),
      )
    : []

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}
      >
        <Typography variant="overline" color="text.secondary">
          {etiqueta}
        </Typography>
        <Chip
          size="small"
          variant={punto ? 'filled' : 'outlined'}
          color={punto ? 'primary' : 'default'}
          label={coordenadas}
        />
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {ayuda}
      </Typography>

      {/* Buscar por código postal: llega al lugar sin tener que mover el mapa a mano */}
      <TextField
        fullWidth
        value={consulta}
        onChange={(evento) => setConsulta(evento.target.value)}
        onKeyDown={(evento) => {
          // Enter busca; no debe enviar el formulario que contiene este campo
          if (evento.key === 'Enter') {
            evento.preventDefault()
            void buscar()
          }
        }}
        label="Buscar por código postal o dirección"
        placeholder="Ej.: 27000 o Col. Centro, Torreón"
        slotProps={{
          htmlInput: { inputMode: 'search', enterKeyHint: 'search', 'aria-label': 'Buscar lugar en el mapa' },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Buscar">
                  <span>
                    <IconButton
                      onClick={() => void buscar()}
                      disabled={buscandoLugar}
                      aria-label="Buscar lugar"
                      edge="end"
                    >
                      {buscandoLugar ? <CircularProgress size={18} /> : <SearchIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1.5 }}
      />

      {resultados ? (
        <Box sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pt: 1 }}>
            Elige el lugar (después puedes afinar el punto tocando el mapa):
          </Typography>
          <List dense disablePadding>
            {resultados.map((lugar) => (
              <ListItemButton key={`${lugar.latitud},${lugar.longitud}`} onClick={() => elegirLugar(lugar)}>
                <ListItemText primary={lugar.etiqueta} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ) : null}

      <MapaUbicacion
        latitud={punto?.latitud ?? null}
        longitud={punto?.longitud ?? null}
        alElegir={marcar}
        etiqueta={`Mapa de ${etiqueta.toLowerCase()}`}
      />

      {/* Campos reales del formulario: visibles (se pueden seleccionar y leer)
          pero de solo lectura, porque el punto se pone en el mapa. */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          mt: 1.5,
        }}
      >
        <TextField
          name={CAMPOS.latitud}
          label="Latitud"
          value={punto ? punto.latitud.toFixed(5) : ''}
          placeholder="Sin marcar"
          slotProps={{ input: { readOnly: true } }}
        />
        <TextField
          name={CAMPOS.longitud}
          label="Longitud"
          value={punto ? punto.longitud.toFixed(5) : ''}
          placeholder="Sin marcar"
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>
      <input type="hidden" name={CAMPOS.direccion} value={direccion ?? ''} readOnly />

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: 'wrap', alignItems: 'center', mt: 1.5 }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={
            buscandoPosicion ? <CircularProgress size={14} color="inherit" /> : <MyLocationIcon />
          }
          onClick={usarMiUbicacion}
          disabled={buscandoPosicion}
        >
          {buscandoPosicion ? 'Buscando…' : 'Usar mi ubicación'}
        </Button>
        {punto ? (
          <Button size="small" onClick={quitar} startIcon={<CloseIcon />}>
            Quitar punto
          </Button>
        ) : null}
      </Stack>

      {estado === 'buscando' ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            Buscando la dirección del punto…
          </Typography>
        </Stack>
      ) : null}

      {estado === 'listo' && direccion ? (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {direccion}
          </Typography>
          {lugares.length > 0 ? (
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.75 }}>
              {lugares.map((lugar) => (
                <Chip key={lugar} size="small" variant="outlined" label={lugar} />
              ))}
            </Stack>
          ) : null}
        </Box>
      ) : null}

      {estado === 'sinDireccion' ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          El punto quedó guardado con sus coordenadas, pero no pudimos obtener la dirección.
        </Typography>
      ) : null}

      {aviso ? (
        <Alert
          severity="warning"
          sx={{ mt: 1.5 }}
          action={
            <Tooltip title="Descartar aviso">
              <IconButton size="small" onClick={() => setAviso(null)} aria-label="Descartar aviso">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        >
          {aviso}
        </Alert>
      ) : null}
    </Box>
  )
}
