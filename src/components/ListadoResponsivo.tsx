'use client'

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as MouseEventReact,
  type PointerEvent as PointerEventReact,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { colores, medidas, movimiento, radios, sombras } from '@/theme/theme'

/**
 * ★ COMPONENTE OBLIGATORIO DE LISTADOS (ver AGENTS.md §3.6) ★
 *
 * Toda tabla o listado de la aplicación usa ESTE componente. Trae de serie:
 *
 *  · Buscador        → filtra las filas por cualquier celda, ignorando acentos
 *                      y mayúsculas (ambas vistas). El atajo «/» lo enfoca y
 *                      el contador dice cuántos resultados hay.
 *  · Móvil (< md)    → lista estil Flutter: filas densas con divisor, NO
 *                      tarjetas. Avatar guía (si la fila lo trae), título +
 *                      subtítulo + chips, y las acciones se revelan
 *                      DESLIZANDO hacia la izquierda o con el botón ⋮.
 *  · Escritorio (md+)→ tabla densa con cabecera en mayúsculas.
 *
 * Las DOS presentaciones se pintan siempre y el corte lo hace el CSS del tema
 * (`display` con el breakpoint `md`), no una medición en el cliente: el HTML
 * que sale del servidor ya trae la lista, así el teléfono ve la vista móvil
 * en el primer pintado —antes de que llegue el JavaScript y aunque tarde—.
 * Decidirlo con `useMediaQuery` hacía que el teléfono recibiera la tabla.
 *  · Vacíos          → un mensaje con icono que además explica qué hacer.
 *
 * El dato llega serializado desde un Server Component: aquí no hay consultas
 * ni reglas de permisos, solo presentación.
 */

export interface CeldaListado {
  clave: string
  etiqueta: string
  texto: string
  /** Palabra principal de la fila (título en móvil, negrita en tabla) */
  destacado?: boolean
  /**
   * Si tiene chip, se pinta como etiqueta de estado/rol.
   * «warning» sirve para estados a medias (en mantenimiento, llegó tarde…).
   */
  chip?: {
    etiqueta: string
    tono: 'success' | 'primary' | 'warning' | 'default'
    /**
     * Para el estado «normal» (Activa, Sin criterios): se ve en la tabla de escritorio pero
     * se omite en la lista del teléfono, donde cada chip de más es ruido. Solo se pintan
     * los chips que avisan de algo.
     */
    soloTabla?: boolean
  }
  /** En móvil antepone la etiqueta («Ramas: Ver · Crear»): para datos ambiguos sin ella */
  conEtiqueta?: boolean
}

export interface FilaListado {
  id: number
  /** Enlace al detalle: el título de la fila es clicable */
  href?: string
  celdas: CeldaListado[]
  acciones?: ReactNode
  /**
   * Distintivo circular al inicio de la fila (iniciales de una persona).
   * Da un punto de anclaje visual y hace la lista reconocible de un vistazo.
   */
  avatar?: { texto: string; tono?: 'primary' | 'success' | 'warning' | 'default' }
  /**
   * Grupo al que pertenece la fila («Célula 1 · Rama Norte»). El listado pinta
   * una cabecera cuando el grupo cambia, así que las filas deben venir
   * ordenadas por ese criterio. Sin `grupo`, el listado se ve igual que antes.
   */
  grupo?: string
}

/** Ancho del panel de acciones que aparece al deslizar la fila. */
const ANCHO_ACCIONES = 88

/** ¿La fila abre un grupo nuevo? (el listado debe venir ordenado por grupo) */
function esNuevoGrupo(filas: FilaListado[], indice: number): boolean {
  const fila = filas[indice]
  return fila?.grupo != null && fila.grupo !== filas[indice - 1]?.grupo
}

/** Minúsculas y sin acentos: «Célula» coincide con «celula». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Estado vacío del listado: sin datos o sin resultados de búsqueda. */
function Vacio({
  mensaje,
  buscando = false,
  accion,
  icono,
}: {
  mensaje: string
  buscando?: boolean
  accion?: ReactNode
  icono?: ReactNode
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 3, sm: 4 },
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Box
        aria-hidden
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 48,
          height: 48,
          borderRadius: `${radios.pill}px`,
          bgcolor: 'primary.light',
          color: 'primary.dark',
        }}
      >
        {icono ?? (buscando ? <SearchOffIcon /> : <InboxOutlinedIcon />)}
      </Box>
      <Typography variant="subtitle1" component="p" sx={{ color: 'text.primary' }}>
        {buscando ? 'Sin resultados' : 'Nada por aquí todavía'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
        {mensaje}
      </Typography>
      {accion}
    </Paper>
  )
}

/** Navega al detalle al tocar la fila, salvo que el toque fuera en un botón o enlace. */
function esToqueEnControl(objetivo: EventTarget | null): boolean {
  return objetivo instanceof Element && objetivo.closest('a, button, input, [role="button"]') !== null
}

/** Avatar guía de la fila: iniciales sobre un tono suave. Nada si la fila no lo trae. */
function GuiaFila({ fila }: { fila: FilaListado }) {
  if (!fila.avatar) return null
  return (
    <Avatar
      aria-hidden
      sx={{
        width: 40,
        height: 40,
        flexShrink: 0,
        ...(fila.avatar.tono === 'success'
          ? { bgcolor: colores.tintes.exito, color: 'success.main' }
          : fila.avatar.tono === 'warning'
            ? { bgcolor: colores.tintes.advertencia, color: 'warning.main' }
            : {}),
      }}
    >
      {fila.avatar.texto}
    </Avatar>
  )
}

/** Contenido de una fila en vista lista: título + detalle + chips de estado. */
function ContenidoFila({ fila }: { fila: FilaListado }) {
  const titulo = fila.celdas
    .filter((celda) => celda.destacado)
    .map((celda) => celda.texto)
    .join(' · ')

  // Detalle: solo valores (la etiqueta sobra casi siempre y quita sitio), sin los vacíos «—»
  const subtitulo = fila.celdas
    .filter((celda) => !celda.destacado && !celda.chip && celda.texto !== '—')
    .map((celda) => (celda.conEtiqueta ? `${celda.etiqueta}: ${celda.texto}` : celda.texto))
    .join(' · ')

  const chips = fila.celdas.flatMap((celda) =>
    celda.chip && !celda.chip.soloTabla ? [{ clave: celda.clave, ...celda.chip }] : [],
  )

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {titulo ? (
        <Typography variant="subtitle1" sx={{ fontWeight: 650, lineHeight: 1.35 }}>
          {fila.href ? (
            <Link href={fila.href} style={{ color: 'inherit', textDecoration: 'none' }}>
              {titulo}
            </Link>
          ) : (
            titulo
          )}
        </Typography>
      ) : null}
      {subtitulo ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {subtitulo}
        </Typography>
      ) : null}
      {chips.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
          {chips.map((chip) => (
            <Chip
              key={chip.clave}
              size="small"
              label={chip.etiqueta}
              color={chip.tono}
              variant={chip.tono === 'success' ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

/** Cabecera de grupo: separa bloques del listado (por célula, por rama…). */
function CabeceraGrupo({ etiqueta }: { etiqueta: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        pt: 2,
        pb: 0.5,
        bgcolor: 'background.default',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="overline" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
        {etiqueta}
      </Typography>
    </Box>
  )
}

/** Respuesta visual al pulsar una fila tocable (como el ripple de Flutter). */
const estiloFilaTocable = {
  cursor: 'pointer',
  '&:active': { bgcolor: 'action.selected' },
} as const

/** Fila sin acciones: avatar guía, título enlazado, detalle y chips (estilo ListTile). */
function FilaLista({ fila }: { fila: FilaListado }) {
  const router = useRouter()
  return (
    <Box
      onClick={(evento) => {
        if (fila.href && !esToqueEnControl(evento.target)) router.push(fila.href)
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.5,
        bgcolor: 'background.paper',
        minHeight: medidas.zonaTactil + 8,
        ...(fila.href ? estiloFilaTocable : {}),
      }}
    >
      <GuiaFila fila={fila} />
      <ContenidoFila fila={fila} />
    </Box>
  )
}

/**
 * Fila con acciones: deslizar hacia la izquierda (o tocar ⋮) descubre el
 * panel de acciones; se arrastra con el dedo y se suelta con muelle.
 */
function FilaDeslizable({
  fila,
  abierta,
  abrir,
}: {
  fila: FilaListado
  abierta: boolean
  abrir: (valor: boolean) => void
}) {
  const router = useRouter()
  const [dx, setDxState] = useState<number | null>(null)
  const [arrastrando, setArrastrandoState] = useState(false)
  const inicio = useRef<{ x: number; y: number; base: number } | null>(null)
  const movio = useRef(false)
  // La lógica del gesto vive en refs: los eventos de puntero pueden llegar
  // varios en el mismo lote y el estado de render todavía no se ha actualizado.
  const dxRef = useRef<number | null>(null)
  const arrastrandoRef = useRef(false)

  const setDx = (valor: number | null) => {
    dxRef.current = valor
    setDxState(valor)
  }
  const setArrastrando = (valor: boolean) => {
    arrastrandoRef.current = valor
    setArrastrandoState(valor)
  }

  const x = dx !== null ? dx : abierta ? -ANCHO_ACCIONES : 0

  const alBajar = (evento: PointerEventReact<HTMLDivElement>) => {
    inicio.current = { x: evento.clientX, y: evento.clientY, base: x }
    movio.current = false
  }

  const alMover = (evento: PointerEventReact<HTMLDivElement>) => {
    const inicial = inicio.current
    if (!inicial) return
    const ddx = evento.clientX - inicial.x
    const ddy = evento.clientY - inicial.y

    if (!arrastrandoRef.current) {
      // Solo se intercepta el gesto si es claramente horizontal: si es
      // vertical, el navegador sigue haciendo su scroll normal.
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) {
        setArrastrando(true)
        movio.current = true
        evento.currentTarget.setPointerCapture(evento.pointerId)
      } else if (Math.abs(ddy) > 10) {
        inicio.current = null
        return
      } else {
        return
      }
    }

    setDx(Math.min(0, Math.max(-ANCHO_ACCIONES, inicial.base + ddx)))
  }

  const alSoltar = () => {
    const inicial = inicio.current
    if (!inicial) return
    inicio.current = null
    const huboArrastre = arrastrandoRef.current
    setArrastrando(false)
    if (!huboArrastre) {
      // Fue un toque normal: dx no debe arrastrarse nunca entre gestos.
      setDx(null)
      return
    }
    const destino = (dxRef.current ?? inicial.base) < -ANCHO_ACCIONES / 2 ? -ANCHO_ACCIONES : 0
    setDx(null)
    abrir(destino !== 0)
  }

  // Tras arrastrar, el clic posterior no debe activar el enlace de la fila.
  const alClicarCaptura = (evento: MouseEventReact<HTMLDivElement>) => {
    if (movio.current) {
      evento.preventDefault()
      evento.stopPropagation()
      movio.current = false
    }
  }

  // Toque normal: si el panel de acciones estaba abierto lo cierra; si no, abre el detalle.
  const alTocar = (evento: MouseEventReact<HTMLDivElement>) => {
    if (esToqueEnControl(evento.target)) return
    if (abierta) {
      abrir(false)
      return
    }
    if (fila.href) router.push(fila.href)
  }

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: 'background.paper' }}>
      {/* Panel de acciones: queda DETRÁS del contenido, a la derecha */}
      <Box
        aria-hidden={!abierta}
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: ANCHO_ACCIONES,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          borderLeft: 1,
          borderColor: 'divider',
        }}
      >
        {fila.acciones}
      </Box>

      <Box
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClickCapture={alClicarCaptura}
        onClick={alTocar}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          minHeight: medidas.zonaTactil + 8,
          bgcolor: 'background.paper',
          ...(fila.href ? estiloFilaTocable : {}),
          // pan-y: el navegador se queda con el scroll vertical,
          // nosotros manejamos el arrastre horizontal.
          touchAction: 'pan-y',
          transform: `translateX(${x}px)`,
          transition: arrastrando
            ? 'none'
            : `transform ${movimiento.normal} ${movimiento.curva}`,
          userSelect: arrastrando ? 'none' : 'auto',
        }}
      >
        <GuiaFila fila={fila} />
        <ContenidoFila fila={fila} />
        <Tooltip title={abierta ? 'Ocultar acciones' : 'Acciones'}>
          <IconButton
            aria-label={abierta ? 'Ocultar acciones' : 'Mostrar acciones'}
            aria-expanded={abierta}
            onClick={() => abrir(!abierta)}
            sx={{ flexShrink: 0, width: medidas.zonaTactil, height: medidas.zonaTactil }}
          >
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

/** Versión de escritorio: celda de la tabla con su chip si lo lleva. */
function contenidoTabla(celda: CeldaListado): ReactNode {
  if (celda.chip) {
    return (
      <Chip
        size="small"
        label={celda.chip.etiqueta}
        color={celda.chip.tono}
        variant={celda.chip.tono === 'success' ? 'filled' : 'outlined'}
      />
    )
  }
  return celda.texto === '—' ? (
    <Typography component="span" color="text.disabled">
      —
    </Typography>
  ) : (
    celda.texto
  )
}

export default function ListadoResponsivo({
  filas,
  etiquetas,
  accionesCabecera = false,
  mensajeVacio,
  placeholderBuscador = 'Buscar…',
  iconoVacio,
  principal = true,
}: {
  filas: FilaListado[]
  /** Orden y nombre de columnas (también se usan de etiqueta en la fila móvil) */
  etiquetas: string[]
  /** ¿Hay columna de acciones en la tabla? */
  accionesCabecera?: boolean
  mensajeVacio: string
  /** Texto del buscador, p. ej. «Buscar usuarios…» */
  placeholderBuscador?: string
  /** Icono del estado vacío (por defecto, una bandeja) */
  iconoVacio?: ReactNode
  /**
   * ¿Es el listado principal de la pantalla? Solo el principal reclama el atajo
   * «/»: en una página con dos listados, el atajo no debe saltar entre ellos.
   */
  principal?: boolean
}) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filaAbierta, setFilaAbierta] = useState<number | null>(null)
  const entradaBusqueda = useRef<HTMLInputElement | null>(null)

  // Atajo «/»: enfoca el buscador principal sin quitarle el teclado a ningún formulario
  useEffect(() => {
    if (!principal) return
    const alPulsar = (evento: KeyboardEvent) => {
      const objetivo = evento.target
      const escribiendo =
        objetivo instanceof HTMLElement &&
        (objetivo.tagName === 'INPUT' ||
          objetivo.tagName === 'TEXTAREA' ||
          objetivo.isContentEditable)
      if (evento.key !== '/' || escribiendo || evento.metaKey || evento.ctrlKey) return
      evento.preventDefault()
      entradaBusqueda.current?.focus()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [principal])

  const filtradas = useMemo(() => {
    const consulta = normalizar(busqueda.trim())
    if (!consulta) return filas
    return filas.filter((fila) =>
      fila.celdas.some(
        (celda) =>
          normalizar(celda.texto).includes(consulta) ||
          (celda.chip ? normalizar(celda.chip.etiqueta).includes(consulta) : false),
      ),
    )
  }, [filas, busqueda])

  // Sin filas en origen: mensaje base (el buscador no tendría nada que filtrar)
  if (filas.length === 0) return <Vacio mensaje={mensajeVacio} icono={iconoVacio} />

  const buscador = (
    <Box
      role="search"
      sx={{
        display: 'flex',
        alignItems: { xs: 'stretch', md: 'center' },
        gap: 1.5,
        flexWrap: 'wrap',
        // En móvil el buscador se queda fijo bajo la barra superior al hacer scroll.
        // La barra mide su alto + la zona segura del teléfono (muesca), así que aquí
        // hay que sumar lo mismo: si no, en un teléfono con muesca el buscador se
        // mete debajo de la barra.
        position: { xs: 'sticky', md: 'static' },
        top: {
          xs: `calc(${medidas.altoBarraSuperior.movil}px + env(safe-area-inset-top, 0px))`,
          md: 'auto',
        },
        zIndex: { xs: 2, md: 'auto' },
        bgcolor: { xs: 'background.default', md: 'transparent' },
        mx: { xs: -2, sm: -3, md: 0 },
        px: { xs: 2, sm: 3, md: 0 },
        py: { xs: 1, md: 0 },
      }}
    >
      <TextField
        inputRef={entradaBusqueda}
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
        placeholder={placeholderBuscador}
        slotProps={{
          htmlInput: { 'aria-label': placeholderBuscador, enterKeyHint: 'search' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: busqueda ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setBusqueda('')}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
        sx={{ width: { xs: '100%', md: 340 }, bgcolor: 'background.paper' }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
        {busqueda ? `${filtradas.length} de ${filas.length}` : `${filas.length} en total`}
        {principal ? (
          <>
            {' · '}
            <Box component="kbd" sx={{ fontFamily: 'inherit', opacity: 0.7 }}>
              /
            </Box>{' '}
            para buscar
          </>
        ) : null}
      </Typography>
    </Box>
  )

  const sinResultados = filtradas.length === 0
  const vacioBuscando = (
    <Vacio
      buscando
      mensaje={`Nada coincide con «${busqueda}». Prueba con otra palabra o revisa los filtros.`}
      accion={
        <Button variant="outlined" size="small" onClick={() => setBusqueda('')}>
          Limpiar búsqueda
        </Button>
      }
    />
  )

  /** Vista móvil: lista estil Flutter (filas densas, acciones al deslizar). */
  const lista = (
    <Box component="ul" sx={{ m: 0, mt: 2, p: 0, listStyle: 'none' }}>
      {filtradas.map((fila, indice) => (
        <Box component="li" key={fila.id}>
          {esNuevoGrupo(filtradas, indice) ? (
            <CabeceraGrupo etiqueta={fila.grupo as string} />
          ) : indice > 0 ? (
            <Divider />
          ) : null}
          {fila.acciones ? (
            <FilaDeslizable
              fila={fila}
              abierta={filaAbierta === fila.id}
              abrir={(valor) => setFilaAbierta(valor ? fila.id : null)}
            />
          ) : (
            <FilaLista fila={fila} />
          )}
        </Box>
      ))}
    </Box>
  )

  /** Vista de escritorio: tabla densa. */
  const tabla = (
    <TableContainer sx={{ mt: 2, boxShadow: sombras.reposo }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {etiquetas.map((etiqueta) => (
              <TableCell key={etiqueta}>{etiqueta}</TableCell>
            ))}
            {accionesCabecera ? <TableCell align="right">Acciones</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {filtradas.map((fila, indice) => (
            <Fragment key={fila.id}>
              {esNuevoGrupo(filtradas, indice) ? (
                <TableRow>
                  <TableCell colSpan={etiquetas.length + (accionesCabecera ? 1 : 0)}>
                    <Typography variant="overline" color="text.secondary">
                      {fila.grupo}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
              <TableRow
                hover
                onClick={(evento) => {
                  // Toda la fila abre el detalle (no solo el nombre), salvo que el toque fuera en un control
                  if (fila.href && !esToqueEnControl(evento.target)) router.push(fila.href)
                }}
                sx={fila.href ? { cursor: 'pointer' } : undefined}
              >
                {fila.celdas.map((celda) => (
                  <TableCell
                    key={celda.clave}
                    // Una línea por celda: «Sin ubicación marcada» partida en tres filas ensuciaba la tabla
                    sx={
                      celda.destacado
                        ? undefined
                        : {
                            whiteSpace: 'nowrap',
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }
                    }
                    title={!celda.destacado && !celda.chip ? celda.texto : undefined}
                  >
                    {celda.destacado ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <GuiaFila fila={fila} />
                        <Typography sx={{ fontWeight: 600 }}>
                          {fila.href ? (
                            <Link
                              href={fila.href}
                              style={{ color: 'inherit', textDecoration: 'none' }}
                            >
                              {celda.texto}
                            </Link>
                          ) : (
                            celda.texto
                          )}
                        </Typography>
                      </Box>
                    ) : (
                      contenidoTabla(celda)
                    )}
                  </TableCell>
                ))}
                {accionesCabecera ? (
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      {fila.acciones}
                    </Box>
                  </TableCell>
                ) : null}
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )

  return (
    <Box>
      {buscador}
      {sinResultados ? (
        <Box sx={{ mt: 2 }}>{vacioBuscando}</Box>
      ) : (
        <>
          {/* El corte es `md` y lo aplica el CSS del tema (ver §3.6 de AGENTS.md) */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>{lista}</Box>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>{tabla}</Box>
        </>
      )}
    </Box>
  )
}
