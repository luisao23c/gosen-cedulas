import { createTheme, type Shadows } from '@mui/material/styles'

/**
 * ★ ÚNICA FUENTE DE VERDAD DEL DISEÑO ★
 *
 * Todo el color, la tipografía, el radio, la sombra y el movimiento de la
 * aplicación salen de este archivo. Para cambiar la apariencia completa del
 * proyecto, edita aquí.
 *
 * Reglas para el resto del código (ver AGENTS.md §3.1):
 *  - prohibido escribir `#hex`, `rgb()`, `hsl()` fuera de este archivo
 *  - prohibido declarar `fontFamily` o `fontSize` en componentes: usar
 *    `theme.typography.*` o `sx={{ color: 'primary.main' }}`
 *  - radios → `radios.*` · sombras → `sombras.*` · duraciones → `movimiento.*`
 *  - si hace falta un token nuevo, se agrega aquí y se usa por referencia
 */

/* ─────────────────────────────────────────────────────────────
   0) AJUSTES RÁPIDOS  ← para cambiar el aspecto de TODA la app
   Cambia solo estas líneas. Los demás tokens (tonos oscuros y
   claros, tintes de hover, sombras, degradados) se calculan a
   partir de aquí, así que no hay que tocarlos a mano.
   ───────────────────────────────────────────────────────────── */

export const ajustes = {
  /** Color de marca: barra superior, botones, enlaces, estados activos */
  colorPrincipal: '#16563A',
  /** Color de acento: insignias y chips, debe contrastar con el principal */
  colorAcento: '#E8A33D',
  /** Fondo general de la aplicación (las tarjetas siguen blancas) */
  colorFondo: '#F5F7F4',
  /** Fuente de títulos y encabezados */
  fuenteTitulos:
    "'Segoe UI Variable Display', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  /** Fuente del texto corrido y de la interfaz */
  fuenteTexto:
    "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  /** Todo el texto crece o se encoge junto: 1 = normal, 1.1 = 10 % más grande */
  escalaTexto: 1,
  /** Redondez de la interfaz: 1 = normal, 0 = esquinas rectas, 1.5 = muy redondeado */
  escalaRadios: 1,
}

/* ── Ayudas de color ──────────────────────────────────────────
   Trabajan con hex y devuelven hex/rgba: sirven para derivar los
   tonos de la paleta desde los tres colores de `ajustes` sin
   escribirlos a mano. Solo se usan aquí dentro.               */

type Rgb = [number, number, number]

/** `#16563A` o `#163` → [22, 86, 58]. */
function aRgb(hex: string): Rgb {
  const limpio = hex.trim().replace('#', '')
  const completo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((caracter) => caracter + caracter)
          .join('')
      : limpio
  const numero = Number.parseInt(completo, 16)
  return [(numero >> 16) & 255, (numero >> 8) & 255, numero & 255]
}

function aHex([rojo, verde, azul]: Rgb): string {
  return `#${[rojo, verde, azul]
    .map((valor) => Math.round(valor).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

/** Mezcla dos colores: 0 devuelve `base`, 1 devuelve `hacia`. */
function mezclar(base: string, hacia: string, cantidad: number): string {
  const desde = aRgb(base)
  const hasta = aRgb(hacia)
  return aHex(
    desde.map((valor, indice) => valor + (hasta[indice] - valor) * cantidad) as Rgb,
  )
}

/** El color aclarado hacia el blanco (0 = igual, 1 = blanco). */
function aclarar(color: string, cantidad: number): string {
  return mezclar(color, '#FFFFFF', cantidad)
}

/** El color oscurecido hacia un casi-negro (0 = igual, 1 = negro). */
function oscurecer(color: string, cantidad: number): string {
  return mezclar(color, '#0A0F0C', cantidad)
}

/** El mismo color con opacidad: hover, velos, tintes de estado. */
function alfa(color: string, opacidad: number): string {
  const [rojo, verde, azul] = aRgb(color)
  return `rgba(${rojo}, ${verde}, ${azul}, ${opacidad})`
}

/* ─────────────────────────────────────────────────────────────
   1) TIPOGRAFÍA
   Sale de `ajustes`: para cambiar las fuentes, edita allí.
   ───────────────────────────────────────────────────────────── */

export const fuentes = {
  /** Fuentes para títulos y encabezados */
  titulos: ajustes.fuenteTitulos,
  /** Fuentes para el texto corrido y la interfaz */
  texto: ajustes.fuenteTexto,
  /** Números tabulares y cifras grandes del panel de inicio */
  numeros: ajustes.fuenteTitulos,
}

/** Tamaño en rem escalado por `ajustes.escalaTexto` (1 = sin cambios). */
function tamano(rem: number): string {
  return `${Number((rem * ajustes.escalaTexto).toFixed(3))}rem`
}

/* ─────────────────────────────────────────────────────────────
   2) COLORES
   Cambiar la paleta = cambiar estos valores.
   ───────────────────────────────────────────────────────────── */

export const colores = {
  /** Color principal: acciones, barra superior, estados activos */
  primario: ajustes.colorPrincipal,
  /** Tono profundo del principal: final de los degradados de marca */
  primarioOscuro: oscurecer(ajustes.colorPrincipal, 0.42),
  /** Tono claro del principal: fondos de selección, insignias, aros */
  primarioSuave: aclarar(ajustes.colorPrincipal, 0.9),
  /** Color secundario: acentos, chips, énfasis */
  secundario: ajustes.colorAcento,
  /** Fondo general de la aplicación */
  fondo: ajustes.colorFondo,
  /** Fondo de tarjetas, paneles y diálogos (paper) */
  superficie: aclarar(ajustes.colorFondo, 1),
  /** Superficie apenas teñida: barras, cabeceras de tabla, menú lateral */
  superficieAlt: mezclar(ajustes.colorPrincipal, aclarar(ajustes.colorFondo, 1), 0.97),
  /** Color del texto principal */
  texto: oscurecer(ajustes.colorPrincipal, 0.82),
  /** Texto secundario: descripciones, etiquetas de apoyo */
  textoSuave: mezclar(oscurecer(ajustes.colorPrincipal, 0.82), aclarar(ajustes.colorFondo, 1), 0.42),
  /** Texto sobre fondos de color */
  textoInvertido: aclarar(ajustes.colorFondo, 1),
  /** Estados de la interfaz: no cambian con la marca, significan lo mismo siempre */
  exito: '#1E7A3E',
  advertencia: '#C07600',
  error: '#B3261E',
  /** Líneas y bordes */
  borde: aclarar(ajustes.colorPrincipal, 0.88),
  bordeFuerte: aclarar(ajustes.colorPrincipal, 0.8),
  /** Estados deshabilitados */
  deshabilitado: aclarar(ajustes.colorPrincipal, 0.65),
  /** Velo claro sobre superficies de marca (insignias y chips del inicio) */
  veloMarca: alfa(aclarar(ajustes.colorFondo, 1), 0.18),
  /** Borde del velo anterior */
  veloMarcaBorde: alfa(aclarar(ajustes.colorFondo, 1), 0.28),
  /** Tinte de chip de éxito, para los avatares/insignias de estado */
  tintes: {
    exito: alfa('#1E7A3E', 0.12),
    advertencia: alfa('#C07600', 0.14),
  },
}

/* ─────────────────────────────────────────────────────────────
   3) RADIOS, SOMBRAS Y MOVIMIENTO
   Valores compartidos para que todas las superficies de la
   aplicación tengan el mismo lenguaje formal.
   ───────────────────────────────────────────────────────────── */

/** Radio en píxeles escalado por `ajustes.escalaRadios`. */
function radio(valor: number): number {
  return Math.round(valor * ajustes.escalaRadios)
}

export const radios = {
  /** Campos, chips e insignias */
  chico: radio(10),
  /** Botones de icono, celdas, elementos de lista */
  medio: radio(14),
  /** Tarjetas, paneles y contenedores de listado */
  grande: radio(18),
  /** Diálogos y superficies flotantes grandes */
  extra: radio(22),
  /** Píldora completa (botones, chips de filtro, barras) */
  pill: 999,
}

/** Tinta de las sombras: el color de marca muy oscurecido, nunca negro puro. */
const tintaSombraBase = oscurecer(ajustes.colorPrincipal, 0.7)
const tintaSombra = alfa(tintaSombraBase, 0.09)

export const sombras = {
  /** Descanso: tarjetas planas sobre el fondo */
  reposo: `0 1px 2px ${tintaSombra}`,
  /** Un escalón por encima: filas al pasar el cursor, barras */
  suave: `0 2px 8px ${tintaSombra}`,
  /** Elemento destacado o hover de tarjeta */
  media: `0 10px 28px ${tintaSombra}`,
  /** Flotante: diálogos, menús, botón flotante */
  alta: `0 18px 44px ${alfa(tintaSombraBase, 0.16)}`,
} as const

/**
 * Escala de 25 sombras que espera MUI (`theme.shadows`), construida con la
 * misma tinta para que `boxShadow: 3` siga siendo coherente con los tokens.
 */
function escalaDeSombras(): string[] {
  return Array.from({ length: 25 }, (_valor, nivel) => {
    if (nivel === 0) return 'none'
    const difusa = 2 + nivel * 1.4
    const elevacion = Math.min(nivel, 8) * 1.6
    const opacidad = Math.min(0.06 + nivel * 0.012, 0.18)
    return `0 ${elevacion.toFixed(1)}px ${difusa.toFixed(1)}px ${alfa(tintaSombraBase, Number(opacidad.toFixed(3)))}`
  })
}

/** Duraciones y curvas: una sola forma de moverse en toda la aplicación. */
export const movimiento = {
  /** Cambios de color y opacidad (hover, foco) */
  rapida: '140ms',
  /** Transiciones cortas: elevar una tarjeta, abrir un panel */
  normal: '220ms',
  /** Entradas de diálogo y desplazamientos amplios */
  lenta: '320ms',
  /** Curva de salida: arranca rápido y frena suave */
  curva: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Curva simétrica para cambios de tamaño */
  curvaSuave: 'cubic-bezier(0.4, 0, 0.2, 1)',
}

/** Degradados de marca. Se usan en el login y en la insignia del menú. */
export const degradados = {
  marca: `linear-gradient(135deg, ${colores.primario} 0%, ${colores.primarioOscuro} 100%)`,
  /** Velo suave para el fondo del login */
  ambiente: `radial-gradient(120% 90% at 15% 0%, ${colores.primarioSuave} 0%, ${colores.fondo} 55%)`,
}

/* ─────────────────────────────────────────────────────────────
   4) MEDIDAS DE INTERFAZ
   Tamaños que comparten varios componentes (barras, menú, zonas
   táctiles). Se cambian aquí, no en cada pantalla.
   ───────────────────────────────────────────────────────────── */

export const medidas = {
  /** Ancho del menú lateral en escritorio */
  anchoMenu: 264,
  /** Ancho máximo del contenido: en pantallas muy anchas el texto no se estira */
  anchoMaximoContenido: 1400,
  /** Alto de la barra de navegación inferior (móvil) */
  altoBarraInferior: 64,
  /** Alto de la barra superior (móvil / escritorio) */
  altoBarraSuperior: { movil: 60, escritorio: 68 },
  /** Zona táctil mínima recomendada (Material: 48 px) */
  zonaTactil: 48,
  /** Separación del botón flotante respecto al borde de la pantalla */
  margenFab: 16,
}

/* ─────────────────────────────────────────────────────────────
   4b) MAPAS
   Valores del mapa (Leaflet + OpenStreetMap): dónde se abre por primera
   vez, con cuánto acercamiento y qué alto tiene el lienzo.
   ───────────────────────────────────────────────────────────── */

export const mapa = {
  /** Centro inicial cuando todavía no hay un punto marcado (Torreón, Coahuila) */
  centro: { latitud: 25.5439, longitud: -103.4069 },
  /** Acercamiento inicial (vista de ciudad) */
  zoom: 12,
  /** Acercamiento al mostrar un punto concreto (vista de calle) */
  zoomPunto: 16,
  /** Alto del lienzo: en móvil el formulario es una hoja a pantalla completa */
  alto: { movil: 260, escritorio: 320 },
}

/** Desplazamiento inferior de un elemento flotante en móvil: barra + zona segura del sistema. */
export const sobreBarraInferior = `calc(${medidas.altoBarraInferior}px + env(safe-area-inset-bottom, 0px) + ${medidas.margenFab}px)`

/* ─────────────────────────────────────────────────────────────
   5) TEMA MUI — de aquí en adelante no se toca nada más
   ───────────────────────────────────────────────────────────── */

export const tema = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colores.primario,
      dark: colores.primarioOscuro,
      light: colores.primarioSuave,
      contrastText: colores.textoInvertido,
    },
    secondary: {
      main: colores.secundario,
      contrastText: colores.texto,
    },
    success: { main: colores.exito },
    warning: { main: colores.advertencia },
    error: { main: colores.error },
    background: { default: colores.fondo, paper: colores.superficie },
    text: { primary: colores.texto, secondary: colores.textoSuave, disabled: colores.deshabilitado },
    divider: colores.borde,
    action: {
      hover: alfa(colores.primario, 0.06),
      selected: alfa(colores.primario, 0.1),
      focus: alfa(colores.primario, 0.14),
    },
  },
  shadows: escalaDeSombras() as Shadows,
  typography: {
    fontFamily: `${fuentes.texto}, system-ui, sans-serif`,
    h1: { fontFamily: fuentes.titulos, fontWeight: 700, fontSize: tamano(2.05), letterSpacing: '-0.02em', lineHeight: 1.2 },
    h2: { fontFamily: fuentes.titulos, fontWeight: 700, fontSize: tamano(1.6), letterSpacing: '-0.02em', lineHeight: 1.25 },
    h3: { fontFamily: fuentes.titulos, fontWeight: 650, fontSize: tamano(1.32), letterSpacing: '-0.015em' },
    h4: { fontFamily: fuentes.titulos, fontWeight: 650, fontSize: tamano(1.16), letterSpacing: '-0.01em' },
    h5: { fontFamily: fuentes.titulos, fontWeight: 650, fontSize: tamano(1.04), letterSpacing: '-0.01em' },
    h6: { fontFamily: fuentes.titulos, fontWeight: 650, fontSize: tamano(0.98), letterSpacing: '-0.005em' },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 600 },
    body1: { fontSize: tamano(0.975), lineHeight: 1.6 },
    body2: { fontSize: tamano(0.875), lineHeight: 1.55 },
    caption: { fontSize: tamano(0.78), lineHeight: 1.45 },
    overline: { fontSize: tamano(0.7), fontWeight: 700, letterSpacing: '0.09em', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
  },
  shape: { borderRadius: radios.medio },
  transitions: {
    duration: { shortest: 140, shorter: 180, short: 220, standard: 280, complex: 340 },
    easing: {
      easeInOut: movimiento.curvaSuave,
      easeOut: movimiento.curva,
      easeIn: movimiento.curvaSuave,
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },
  components: {
    /* Base del documento: tipografía nítida, selección, barras de scroll y
       respeto por quien pide menos movimiento. */
    MuiCssBaseline: {
      styleOverrides: (base) => ({
        html: { WebkitTextSizeAdjust: '100%' },
        body: {
          backgroundColor: base.palette.background.default,
          color: base.palette.text.primary,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        },
        '::selection': { backgroundColor: colores.primarioSuave, color: colores.primarioOscuro },
        // Chrome de Leaflet: los mapas hablan el mismo idioma visual que el resto
        '.leaflet-container': {
          backgroundColor: colores.fondo,
          fontFamily: 'inherit',
          fontSize: 'inherit',
        },
        '.leaflet-control-attribution': {
          backgroundColor: colores.superficie,
          color: colores.textoSuave,
          fontSize: '0.7rem',
          padding: '2px 6px',
          borderRadius: radios.chico,
        },
        '.leaflet-control-attribution a': { color: colores.primarioOscuro },
        '.leaflet-bar a': {
          color: colores.texto,
          backgroundColor: colores.superficie,
          borderColor: colores.borde,
          fontFamily: 'inherit',
        },
        '.leaflet-bar a:hover': { backgroundColor: colores.primarioSuave },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: colores.bordeFuerte,
          borderRadius: radios.pill,
          border: `2px solid transparent`,
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': { backgroundColor: colores.deshabilitado },
        // Los campos de fecha y hora nativos no deben romper la altura del campo
        'input[type="date"], input[type="time"], input[type="datetime-local"]': {
          minHeight: '1.4375em',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      }),
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          paddingInline: 20,
          minHeight: 42,
          borderRadius: radios.pill,
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}, box-shadow ${movimiento.normal} ${movimiento.curva}, transform ${movimiento.rapida} ${movimiento.curva}`,
          '&:active': { transform: 'translateY(1px)' },
        },
        sizeLarge: { minHeight: medidas.zonaTactil, paddingInline: 26 },
        sizeSmall: { minHeight: 34, paddingInline: 14 },
        contained: { boxShadow: sombras.reposo },
        outlined: { borderColor: colores.bordeFuerte, '&:hover': { borderColor: colores.primario } },
        text: { paddingInline: 14 },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            backgroundImage: degradados.marca,
            '&:hover': { boxShadow: sombras.suave },
          },
        },
      ],
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: radios.medio,
          minWidth: 40,
          minHeight: 40,
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}, color ${movimiento.rapida} ${movimiento.curva}`,
        },
        sizeSmall: { minWidth: 34, minHeight: 34 },
      },
    },

    MuiFab: {
      styleOverrides: {
        root: {
          borderRadius: radios.pill,
          boxShadow: sombras.alta,
          backgroundImage: degradados.marca,
          transition: `box-shadow ${movimiento.normal} ${movimiento.curva}, transform ${movimiento.rapida} ${movimiento.curva}`,
          '&:active': { transform: 'translateY(1px)' },
        },
        extended: { paddingInline: 22, gap: 10 },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: radios.grande, backgroundImage: 'none' },
        outlined: { borderColor: colores.borde },
        elevation1: { boxShadow: sombras.reposo },
        elevation2: { boxShadow: sombras.suave },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: radios.grande,
          border: `1px solid ${colores.borde}`,
          boxShadow: sombras.reposo,
        },
      },
    },

    /* Campos: borde suave en reposo, aro de foco visible (accesibilidad) */
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radios.chico,
          backgroundColor: colores.superficie,
          transition: `box-shadow ${movimiento.rapida} ${movimiento.curva}`,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colores.bordeFuerte },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colores.deshabilitado },
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${colores.primarioSuave}` },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colores.primario,
            borderWidth: 1.5,
          },
        },
        input: { paddingTop: 12, paddingBottom: 12 },
        multiline: { padding: 0 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2 } } },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: radios.chico,
          fontWeight: 600,
          height: 28,
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}`,
        },
        clickable: { minHeight: 32, height: 32, borderRadius: radios.pill },
        sizeSmall: { height: 26 },
        colorSuccess: { backgroundColor: alfa(colores.exito, 0.12), color: colores.exito },
        colorPrimary: { backgroundColor: colores.primarioSuave, color: colores.primarioOscuro },
      },
    },

    /* Tablas: cabecera fija, cejas en mayúsculas y filas que responden */
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: radios.grande,
          border: `1px solid ${colores.borde}`,
          backgroundColor: colores.superficie,
        },
      },
    },
    MuiTable: { styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colores.borde}`,
          paddingBlock: 12,
          paddingInline: 16,
        },
        head: {
          backgroundColor: colores.superficieAlt,
          color: colores.textoSuave,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          borderBottom: `1px solid ${colores.borde}`,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}`,
          '&:last-of-type td': { borderBottom: 'none' },
        },
      },
    },
    MuiTableSortLabel: { styleOverrides: { root: { '&:hover': { color: colores.texto } } } },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: medidas.zonaTactil,
          borderRadius: radios.medio,
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}, color ${movimiento.rapida} ${movimiento.curva}`,
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 40 } } },

    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundImage: 'none', border: 'none' },
      },
    },

    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: {
          backgroundColor: alfa(colores.superficie, 0.82),
          backdropFilter: 'saturate(180%) blur(14px)',
          color: colores.texto,
        },
      },
    },

    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: alfa(colores.superficie, 0.92),
          backdropFilter: 'saturate(180%) blur(14px)',
          height: 'auto',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        // Con 5 secciones, el ancho mínimo por defecto (80 px) desbordaría en 390 px
        root: {
          minWidth: 0,
          paddingInline: 2,
          paddingTop: 6,
          paddingBottom: 6,
          '& .MuiBottomNavigationAction-label': { fontSize: '0.7rem', opacity: 0.75 },
          '&.Mui-selected .MuiBottomNavigationAction-label': { fontSize: '0.7rem', fontWeight: 700, opacity: 1 },
        },
      },
    },

    /* Diálogos: centrados y compactos en escritorio, hoja completa en móvil */
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radios.extra, boxShadow: sombras.alta, backgroundImage: 'none' },
      },
    },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: alfa(oscurecer(colores.primario, 0.75), 0.42) } } },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: tamano(1.16), fontWeight: 650, paddingBottom: 4 } },
    },
    MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px' } } },

    MuiMenu: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        paper: {
          borderRadius: radios.grande,
          border: `1px solid ${colores.borde}`,
          boxShadow: sombras.media,
          minWidth: 200,
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: radios.chico, minHeight: 40, gap: 12 },
      },
    },

    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: colores.texto,
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: radios.chico,
          paddingInline: 10,
          paddingBlock: 6,
        },
        arrow: { color: colores.texto },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radios.medio, alignItems: 'center', boxShadow: sombras.media },
      },
      variants: [
        {
          props: { variant: 'filled', severity: 'success' },
          style: { backgroundImage: degradados.marca },
        },
      ],
    },
    MuiSnackbar: { defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'center' } } },

    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: { root: { borderRadius: radios.medio, backgroundColor: alfa(colores.primario, 0.07) } },
    },

    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: radios.pill, height: 6 } },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: colores.borde } } },

    /* Avatares: el tamaño del texto de las iniciales es un valor del tema, no
       de cada componente (§3.1). Si hace falta otro tamaño, se agrega aquí. */
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: colores.primarioSuave,
          color: colores.primarioOscuro,
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.01em',
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        thumb: { boxShadow: sombras.reposo },
      },
    },

    MuiFormControlLabel: {
      styleOverrides: { root: { alignItems: 'center' } },
    },
  },
})

