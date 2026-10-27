import { createTheme, responsiveFontSizes, type Shadows, type Theme } from '@mui/material/styles'

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

/**
 * ① ELIGE UNA PALETA Y UNA TIPOGRAFÍA — es lo único que hace falta tocar.
 *
 * Cada paleta son tres colores; todo lo demás (tonos oscuros y claros, bordes,
 * sombras, degradados) se calcula solo. Para inventar una nueva, copia una
 * línea de `PALETAS` o `TIPOGRAFIAS` y cámbiale los valores.
 */
export const PALETAS = {
  /** Verde bosque con acento ámbar (la original) */
  bosque: { principal: '#16563A', acento: '#E8A33D', fondo: '#F5F7F4' },
  /** Azul profundo con acento naranja: sobria y confiable */
  oceano: { principal: '#0B5CAD', acento: '#F2A33A', fondo: '#F4F7FB' },
  /** Vino con acento dorado: cálida y elegante */
  vino: { principal: '#7A1F3D', acento: '#D9A441', fondo: '#FAF6F5' },
  /** Violeta con acento ámbar: moderna y juvenil */
  violeta: { principal: '#5B3FA6', acento: '#F2B134', fondo: '#F7F5FB' },
  /** Grafito con acento coral: neutra, deja respirar el contenido */
  grafito: { principal: '#2B3A4A', acento: '#E4572E', fondo: '#F4F5F7' },
  /** Terracota con acento turquesa: cercana y alegre */
  terracota: { principal: '#B8461B', acento: '#0F8B8D', fondo: '#FBF6F2' },
  /**
   * Manual de identidad: Luz Serna #E8E7DF (fondo), Semilla #B3B4A5 (acento),
   * Raíz Profunda #3C3B37 y Tierra Viva #232323 (textos), Cherry Mahogany
   * #65362F (color de marca).
   */
  marca: {
    principal: '#65362F',
    acento: '#B3B4A5',
    fondo: '#E8E7DF',
    texto: '#232323',
    textoSuave: '#3C3B37',
  },
} as const

/**
 * Tipografías disponibles. Las que llevan `var(--fuente-…)` se cargan en
 * `app/layout.tsx` (Google Fonts, autoalojadas); si falta una, cae a la del
 * sistema, así que nunca se rompe la pantalla.
 */
const SISTEMA = "system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
export const TIPOGRAFIAS = {
  /** Inter: neutra y muy legible en pantallas pequeñas */
  moderna: { titulos: `var(--fuente-inter), ${SISTEMA}`, texto: `var(--fuente-inter), ${SISTEMA}` },
  /** Poppins en títulos, Nunito en texto: redonda y amable */
  amigable: { titulos: `var(--fuente-poppins), ${SISTEMA}`, texto: `var(--fuente-nunito), ${SISTEMA}` },
  /** Lora en títulos, Inter en texto: editorial y con carácter */
  editorial: { titulos: `var(--fuente-lora), Georgia, serif`, texto: `var(--fuente-inter), ${SISTEMA}` },
  /** Manual de identidad: Minion Pro en títulos, Creato Display en texto e interfaz */
  marca: { titulos: `var(--fuente-minion), Georgia, serif`, texto: `var(--fuente-creato), ${SISTEMA}` },
  /** Solo las fuentes del dispositivo: no descarga nada */
  sistema: { titulos: SISTEMA, texto: SISTEMA },
} as const

export const apariencia: {
  paleta: keyof typeof PALETAS
  tipografia: keyof typeof TIPOGRAFIAS
  /** Todo el texto crece o se encoge junto: 1 = normal, 1.1 = 10 % más grande */
  escalaTexto: number
  /** Redondez de la interfaz: 1 = normal, 0 = esquinas rectas, 1.5 = muy redondeado */
  escalaRadios: number
} = {
  paleta: 'marca',
  tipografia: 'marca',
  escalaTexto: 1,
  escalaRadios: 1,
}

/**
 * ② Ajuste fino (opcional): estos valores salen de la paleta y la tipografía
 * elegidas arriba. Solo edítalos si quieres un color o fuente propios.
 */
export const ajustes = {
  /** Color de marca: barra superior, botones, enlaces, estados activos */
  colorPrincipal: PALETAS[apariencia.paleta].principal as string,
  /** Color de acento: insignias y chips, debe contrastar con el principal */
  colorAcento: PALETAS[apariencia.paleta].acento as string,
  /** Fondo general de la aplicación (las tarjetas siguen blancas) */
  colorFondo: PALETAS[apariencia.paleta].fondo as string,
  /** Texto principal y secundario; si la paleta no los trae, se derivan del color de marca */
  colorTexto: ('texto' in PALETAS[apariencia.paleta]
    ? (PALETAS[apariencia.paleta] as { texto: string }).texto
    : null) as string | null,
  colorTextoSuave: ('textoSuave' in PALETAS[apariencia.paleta]
    ? (PALETAS[apariencia.paleta] as { textoSuave: string }).textoSuave
    : null) as string | null,
  /** Fuente de títulos y encabezados */
  fuenteTitulos: TIPOGRAFIAS[apariencia.tipografia].titulos as string,
  /** Fuente del texto corrido y de la interfaz */
  fuenteTexto: TIPOGRAFIAS[apariencia.tipografia].texto as string,
  escalaTexto: apariencia.escalaTexto,
  escalaRadios: apariencia.escalaRadios,
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

/**
 * Hay DOS juegos de valores —claro y oscuro— con exactamente las mismas claves. En los componentes
 * NO se usan directamente: se usa `colores` (más abajo), que son referencias a variables CSS
 * (`var(--g-fondo)`…) que el navegador resuelve según el modo activo. Así el cambio de modo no
 * necesita volver a pintar nada con JavaScript y no hay parpadeo al cargar.
 */
const textoClaro = ajustes.colorTexto ?? oscurecer(ajustes.colorPrincipal, 0.82)

const VALORES_CLAROS = {
  /** Color principal: acciones, barra superior, estados activos */
  primario: ajustes.colorPrincipal,
  /** Tono profundo del principal: final de los degradados de marca */
  primarioOscuro: oscurecer(ajustes.colorPrincipal, 0.42),
  /** Tono claro del principal: fondos de selección, insignias, aros */
  primarioSuave: aclarar(ajustes.colorPrincipal, 0.9),
  /** Color secundario: acentos, chips, énfasis */
  secundario: ajustes.colorAcento,
  /**
   * Lienzo de la aplicación: el color de fondo de la marca aclarado. Las tarjetas (blancas) se
   * separan de él por contraste, no por bordes pesados ni sombras: así se lee limpio.
   */
  fondo: aclarar(ajustes.colorFondo, 0.6),
  /** Fondo de tarjetas, paneles y diálogos (paper) */
  superficie: aclarar(ajustes.colorFondo, 1),
  /** Superficie apenas teñida con el color de fondo de la marca: cabeceras de tabla, paneles, fondos de selección */
  superficieAlt: aclarar(ajustes.colorFondo, 0.35),
  /** Un escalón más marcado: chips neutros, barras de progreso, huecos */
  superficieMedia: ajustes.colorFondo,
  /** Color del texto principal */
  texto: ajustes.colorTexto ?? oscurecer(ajustes.colorPrincipal, 0.82),
  /** Texto secundario: descripciones, etiquetas de apoyo */
  textoSuave: mezclar(
    ajustes.colorTextoSuave ?? ajustes.colorTexto ?? oscurecer(ajustes.colorPrincipal, 0.82),
    aclarar(ajustes.colorFondo, 1),
    0.18, // más claro que `texto`, pero sin bajar de 4.5:1 ni sobre el lienzo ni sobre los chips neutros
  ),
  /** Texto sobre botones y selecciones del color principal */
  textoInvertido: aclarar(ajustes.colorFondo, 1),
  /** Texto sobre el degradado de marca (portada del inicio, login, turno): claro en los dos modos */
  textoSobreMarca: aclarar(ajustes.colorFondo, 1),
  /** Texto sobre el color de acento */
  textoSobreAcento: textoClaro,
  /** Estados de la interfaz: no cambian con la marca, significan lo mismo siempre */
  exito: '#1E7A3E',
  // Ámbar profundo: el ámbar claro (#C07600) no llegaba a 4.5:1 como texto de chip
  advertencia: '#8F5500',
  error: '#B3261E',
  /** Líneas y bordes */
  // Neutros cálidos sacados del fondo de la marca (no del color de marca: evita bordes rosados)
  borde: mezclar(ajustes.colorFondo, ajustes.colorTexto ?? '#232323', 0.07),
  bordeFuerte: mezclar(ajustes.colorFondo, ajustes.colorTexto ?? '#232323', 0.2),
  /** Estados deshabilitados */
  deshabilitado: aclarar(ajustes.colorPrincipal, 0.65),
  /** Velo claro sobre superficies de marca (insignias y chips del inicio) */
  veloMarca: alfa(aclarar(ajustes.colorFondo, 1), 0.18),
  /** Borde del velo anterior */
  veloMarcaBorde: alfa(aclarar(ajustes.colorFondo, 1), 0.28),
  /** Tinte de chip de éxito, para los avatares/insignias de estado */
  tintes: {
    exito: alfa('#1E7A3E', 0.12),
    advertencia: alfa('#8F5500', 0.16),
    error: alfa('#B3261E', 0.1),
  },
  /** Respuesta al pasar el cursor por encima (botones de contorno, filas, acciones de MUI) */
  hover: alfa(textoClaro, 0.04),
  hoverFila: alfa(textoClaro, 0.03),
  /** Elemento seleccionado y foco de teclado */
  seleccion: alfa(ajustes.colorPrincipal, 0.08),
  foco: alfa(ajustes.colorPrincipal, 0.12),
  /** Esqueletos de carga */
  esqueleto: alfa(ajustes.colorPrincipal, 0.07),
  /** Velo detrás de los diálogos */
  velo: alfa(oscurecer(ajustes.colorPrincipal, 0.75), 0.42),
  /** Globo de ayuda (tooltip): fondo y texto */
  globo: textoClaro,
  textoGlobo: aclarar(ajustes.colorFondo, 1),
  /**
   * Logo: dos versiones (tinta oscura para fondos claros y tinta clara para fondos oscuros). Estos
   * valores son el `display` de cada una: el CSS elige cuál se ve según el modo, sin esperar a JavaScript.
   */
  logoTintaOscura: 'block',
  logoTintaClara: 'none',
}

type Valores = typeof VALORES_CLAROS

/**
 * Modo oscuro. Sale de la misma paleta: el texto de la marca (Tierra Viva) hace de fondo, el fondo de
 * la marca (Luz Serna) hace de texto y el color de marca se aclara para que siga leyéndose sobre oscuro.
 */
const fondoOscuro = mezclar(textoClaro, '#0A0F0C', 0.3)
const superficieOscura = mezclar(fondoOscuro, '#FFFFFF', 0.06)
const textoOscuro = aclarar(ajustes.colorFondo, 0.45)
const primarioClaro = aclarar(ajustes.colorPrincipal, 0.5)
const exitoOscuro = '#5CC17F'
const advertenciaOscura = '#F0B34A'
const errorOscuro = '#F5958E'

const VALORES_OSCUROS: Valores = {
  primario: primarioClaro,
  /** En oscuro es un tono MÁS claro: texto sobre los chips y fondos suaves de marca */
  primarioOscuro: aclarar(ajustes.colorPrincipal, 0.62),
  primarioSuave: mezclar(superficieOscura, primarioClaro, 0.22),
  secundario: ajustes.colorAcento,
  fondo: fondoOscuro,
  superficie: superficieOscura,
  superficieAlt: mezclar(fondoOscuro, '#FFFFFF', 0.09),
  superficieMedia: mezclar(fondoOscuro, '#FFFFFF', 0.14),
  texto: textoOscuro,
  textoSuave: mezclar(textoOscuro, superficieOscura, 0.28),
  textoInvertido: fondoOscuro,
  textoSobreMarca: aclarar(ajustes.colorFondo, 1),
  textoSobreAcento: fondoOscuro,
  exito: exitoOscuro,
  advertencia: advertenciaOscura,
  error: errorOscuro,
  borde: mezclar(superficieOscura, textoOscuro, 0.1),
  bordeFuerte: mezclar(superficieOscura, textoOscuro, 0.26),
  deshabilitado: mezclar(superficieOscura, textoOscuro, 0.32),
  veloMarca: alfa(aclarar(ajustes.colorFondo, 1), 0.18),
  veloMarcaBorde: alfa(aclarar(ajustes.colorFondo, 1), 0.28),
  tintes: {
    exito: alfa(exitoOscuro, 0.16),
    advertencia: alfa(advertenciaOscura, 0.16),
    error: alfa(errorOscuro, 0.16),
  },
  hover: alfa(textoOscuro, 0.06),
  hoverFila: alfa(textoOscuro, 0.05),
  seleccion: alfa(primarioClaro, 0.14),
  foco: alfa(primarioClaro, 0.22),
  esqueleto: alfa(textoOscuro, 0.08),
  velo: alfa('#000000', 0.6),
  globo: mezclar(superficieOscura, '#FFFFFF', 0.22),
  textoGlobo: textoOscuro,
  logoTintaOscura: 'none',
  logoTintaClara: 'block',
}

/** Valores REALES (hex) de cada modo: para lo que no entiende `var()` (manifest, barra del navegador, MUI). */
export const paletaReal = { claro: VALORES_CLAROS, oscuro: VALORES_OSCUROS } as const

type Referencias<T> = { [K in keyof T]: T[K] extends string ? string : Referencias<T[K]> }

/** `{ fondo: '#…' }` → `{ fondo: 'var(--g-fondo)' }` (y lo mismo en los grupos anidados: `tintes.exito`). */
function referencias<T extends object>(valores: T, prefijo = '--g'): Referencias<T> {
  return Object.fromEntries(
    Object.entries(valores).map(([clave, valor]) => [
      clave,
      typeof valor === 'string' ? `var(${prefijo}-${clave})` : referencias(valor as object, `${prefijo}-${clave}`),
    ]),
  ) as Referencias<T>
}

/** `{ fondo: '#…' }` → `{ '--g-fondo': '#…' }`: las declaraciones de variables CSS de un modo. */
function variablesCss(valores: object, prefijo = '--g'): Record<string, string> {
  return Object.assign(
    {},
    ...Object.entries(valores).map(([clave, valor]) =>
      typeof valor === 'string'
        ? { [`${prefijo}-${clave}`]: valor }
        : variablesCss(valor as object, `${prefijo}-${clave}`),
    ),
  )
}

/**
 * ★ Los colores que se usan en componentes ★ — son referencias a variables CSS, no hex: cambian solos
 * con el modo claro/oscuro. Se pueden escribir dentro de cualquier valor de CSS
 * (`border: \`1px solid ${colores.borde}\``). No sirven para operar con ellos en JavaScript
 * (mezclar, aclarar…): para eso están los valores reales en `paletaReal`.
 */
export const colores = referencias(VALORES_CLAROS)

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
  chico: radio(8),
  /** Botones de icono, celdas, elementos de lista */
  medio: radio(12),
  /** Tarjetas, paneles y contenedores de listado */
  grande: radio(16),
  /** Diálogos y superficies flotantes grandes */
  extra: radio(24),
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

/**
 * Degradados de marca. `marca` es el color de la marca tal cual en los dos modos (es identidad: la
 * portada del inicio, el login y el turno destacado se ven igual de noche) y se acompaña con
 * `colores.textoSobreMarca`. `ambiente` sí sigue el modo.
 */
export const degradados = {
  marca: `linear-gradient(135deg, ${ajustes.colorPrincipal} 0%, ${oscurecer(ajustes.colorPrincipal, 0.2)} 100%)`,
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
  /** Ancho del menú lateral contraído (solo iconos) */
  anchoMenuCompacto: 72,
  /** Separación de la barra inferior flotante respecto a los bordes de la pantalla */
  margenNavFlotante: 12,
  /** Ancho máximo del contenido: en pantallas muy anchas el texto no se estira */
  anchoMaximoContenido: 1400,
  /** Alto de la barra de navegación inferior (móvil) */
  altoBarraInferior: 64,
  /** Alto de la barra superior (móvil / escritorio) */
  altoBarraSuperior: { movil: 56, escritorio: 68 },
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
  /** País en el que se buscan códigos postales y direcciones (código de 2 letras, ISO 3166) */
  pais: 'mx',
  /** Acercamiento inicial (vista de ciudad) */
  zoom: 12,
  /** Acercamiento al mostrar un punto concreto (vista de calle) */
  zoomPunto: 16,
  /** Alto del lienzo: en móvil el formulario es una hoja a pantalla completa */
  alto: { movil: 260, escritorio: 320 },
  /** Las teselas de OpenStreetMap son claras: en modo oscuro se invierten para no deslumbrar */
  filtroOscuro: 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92)',
}

/**
 * Fila que se desliza de lado y llega hasta el borde de la pantalla en el teléfono (chips de filtro,
 * pestañas en píldora) sin perder la alineación de su primer elemento con el contenido.
 * Se usa como `sx={(tema) => ({ ...alBorde(tema), … })}`.
 *
 * A propósito NO son márgenes negativos (`mx: -2`): un `Stack` padre reinicia los márgenes de sus hijos
 * y los anula, y la fila quedaba 16 px más adentro que el resto del contenido.
 */
export function alBorde(tema: Theme) {
  return {
    position: 'relative' as const,
    left: tema.spacing(-2),
    width: `calc(100% + ${tema.spacing(4)})`,
    px: 2,
    [tema.breakpoints.up('sm')]: { left: tema.spacing(-3), width: `calc(100% + ${tema.spacing(6)})`, px: 3 },
    [tema.breakpoints.up('md')]: { left: 0, width: '100%', px: 0 },
  }
}

/** Desplazamiento inferior de un elemento flotante en móvil: barra + zona segura del sistema. */
export const sobreBarraInferior = `calc(${medidas.altoBarraInferior}px + ${medidas.margenNavFlotante}px + env(safe-area-inset-bottom, 0px) + ${medidas.margenFab}px)`

/* ─────────────────────────────────────────────────────────────
   5) TEMA MUI — de aquí en adelante no se toca nada más
   ───────────────────────────────────────────────────────────── */

/** Paleta de MUI de un modo (sus componentes internos —botones, campos, menús— leen de aquí). */
function paletaMui(valores: Valores) {
  return {
    primary: {
      main: valores.primario,
      dark: valores.primarioOscuro,
      light: valores.primarioSuave,
      contrastText: valores.textoInvertido,
    },
    secondary: { main: valores.secundario, contrastText: valores.textoSobreAcento },
    success: { main: valores.exito },
    warning: { main: valores.advertencia },
    error: { main: valores.error },
    background: { default: valores.fondo, paper: valores.superficie },
    text: { primary: valores.texto, secondary: valores.textoSuave, disabled: valores.deshabilitado },
    divider: valores.borde,
    action: { hover: valores.hover, selected: valores.seleccion, focus: valores.foco },
  }
}

/**
 * Con `colorSchemeSelector: 'data'` MUI pone en <html> el atributo `data-light` o `data-dark` (lo escribe
 * `InitColorSchemeScript` antes de pintar). Las variables propias (`colores`) se conmutan con el mismo.
 */
const RAIZ_OSCURA = ':root[data-dark]'

const temaBase = createTheme({
  // Variables CSS + dos esquemas: MUI cambia entre claro y oscuro con un atributo, sin repintar con JS
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: { palette: paletaMui(VALORES_CLAROS) },
    dark: { palette: paletaMui(VALORES_OSCUROS) },
  },
  shadows: escalaDeSombras() as Shadows,
  typography: {
    fontFamily: `${fuentes.texto}, system-ui, sans-serif`,
    // Títulos: Minion Pro (serif editorial) con peso 600 y tamaños que se REDUCEN solos en el teléfono
    h1: { fontFamily: fuentes.titulos, fontWeight: 600, fontSize: tamano(2.5), letterSpacing: '-0.02em', lineHeight: 1.12 },
    h2: { fontFamily: fuentes.titulos, fontWeight: 600, fontSize: tamano(2), letterSpacing: '-0.015em', lineHeight: 1.15 },
    h3: { fontFamily: fuentes.titulos, fontWeight: 600, fontSize: tamano(1.5), letterSpacing: '-0.01em', lineHeight: 1.2 },
    h4: { fontFamily: fuentes.titulos, fontWeight: 600, fontSize: tamano(1.25), letterSpacing: '-0.005em', lineHeight: 1.25 },
    h5: { fontFamily: fuentes.titulos, fontWeight: 600, fontSize: tamano(1.125), lineHeight: 1.3 },
    h6: { fontFamily: fuentes.titulos, fontWeight: 600, fontSize: tamano(1), lineHeight: 1.3 },
    // Interfaz: Creato Display. Base de 16 px (cuerpo) y 15 px (secundario) para leerse bien en el teléfono
    subtitle1: { fontWeight: 700, fontSize: tamano(1), lineHeight: 1.35 },
    subtitle2: { fontWeight: 700, fontSize: tamano(0.9375), lineHeight: 1.35 },
    body1: { fontSize: tamano(1), lineHeight: 1.55 },
    body2: { fontSize: tamano(0.9375), lineHeight: 1.5 },
    caption: { fontSize: tamano(0.8125), lineHeight: 1.4 },
    overline: { fontSize: tamano(0.75), fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 700, fontSize: tamano(0.9375), letterSpacing: 0 },
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
      styleOverrides: () => ({
        // Variables de color propias (`colores`): las del modo claro en la raíz y las del oscuro encima cuando toca
        ':root': variablesCss(VALORES_CLAROS),
        [RAIZ_OSCURA]: variablesCss(VALORES_OSCUROS),
        // Las teselas del mapa son claras: de noche se invierten
        [`${RAIZ_OSCURA} .leaflet-tile-pane`]: { filter: mapa.filtroOscuro },
        // Comportamiento de app: sin resaltado azul al tocar, sin retardo ni zoom por doble toque, y sin el
        // «rebote» del navegador (el gesto de jalar lo gestiona la app: JalarParaActualizar)
        html: { WebkitTextSizeAdjust: '100%', WebkitTapHighlightColor: 'transparent', overscrollBehaviorY: 'contain' },
        'a, button, [role="button"], input, select, textarea': { touchAction: 'manipulation' },
        // Entrada de cada pantalla: fundido corto con un leve ascenso
        '@keyframes entradaPagina': {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'none' },
        },
        body: {
          backgroundColor: colores.fondo,
          color: colores.texto,
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
          paddingInline: 18,
          minHeight: 44,
          borderRadius: radios.medio,
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}, border-color ${movimiento.rapida} ${movimiento.curva}, transform ${movimiento.rapida} ${movimiento.curva}`,
          '&:active': { transform: 'translateY(1px)' },
        },
        sizeLarge: { minHeight: 52, paddingInline: 24 },
        sizeSmall: { minHeight: 36, paddingInline: 12, fontSize: tamano(0.875) },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        outlined: {
          borderColor: colores.bordeFuerte,
          color: colores.texto,
          '&:hover': { borderColor: colores.texto, backgroundColor: colores.hover },
        },
        text: { paddingInline: 12 },
      },
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
          boxShadow: sombras.media,
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
        elevation1: { boxShadow: 'none' },
        elevation2: { boxShadow: sombras.suave },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: radios.grande,
          border: `1px solid ${colores.borde}`,
          boxShadow: 'none',
        },
      },
    },

    /* Campos: borde suave en reposo, aro de foco visible (accesibilidad) */
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radios.medio,
          backgroundColor: colores.superficie,
          transition: `box-shadow ${movimiento.rapida} ${movimiento.curva}`,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colores.bordeFuerte },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colores.textoSuave },
          // Foco: borde de marca de 2 px y ya (sin halo difuso)
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colores.primario,
            borderWidth: 2,
          },
        },
        input: { paddingTop: 15, paddingBottom: 15 },
        multiline: { padding: 0 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 500, color: colores.textoSuave } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2 } } },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: radios.chico,
          fontWeight: 700,
          fontSize: tamano(0.8125),
          height: 28,
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}`,
        },
        clickable: { minHeight: 36, height: 36, borderRadius: radios.pill, paddingInline: 4 },
        sizeSmall: { height: 24, fontSize: tamano(0.78) },
        outlined: { borderColor: colores.bordeFuerte },
      },
      // Tonales: el estado se lee por el tinte, no por un contorno
      variants: [
        { props: { variant: 'filled', color: 'default' }, style: { backgroundColor: colores.superficieMedia, color: colores.textoSuave } },
        { props: { variant: 'filled', color: 'primary' }, style: { backgroundColor: colores.primarioSuave, color: colores.primarioOscuro } },
        { props: { variant: 'filled', color: 'success' }, style: { backgroundColor: colores.tintes.exito, color: colores.exito } },
        { props: { variant: 'filled', color: 'warning' }, style: { backgroundColor: colores.tintes.advertencia, color: colores.advertencia } },
        { props: { variant: 'filled', color: 'error' }, style: { backgroundColor: colores.tintes.error, color: colores.error } },
      ],
    },

    /* Control segmentado (p. ej. el selector de apariencia): pista hundida y opción activa elevada */
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { backgroundColor: colores.superficieMedia, borderRadius: radios.medio, padding: 3, gap: 2 },
        grouped: {
          margin: 0,
          border: 0,
          borderRadius: radios.chico,
          '&:not(:first-of-type), &:first-of-type, &:not(:last-of-type)': { borderRadius: radios.chico },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 38,
          textTransform: 'none',
          fontWeight: 700,
          color: colores.textoSuave,
          '&.Mui-selected': {
            backgroundColor: colores.superficie,
            color: colores.texto,
            boxShadow: sombras.reposo,
            '&:hover': { backgroundColor: colores.superficie },
          },
        },
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
          paddingBlock: 14,
          paddingInline: 16,
          fontSize: tamano(0.9375),
        },
        head: {
          backgroundColor: colores.superficieAlt,
          color: colores.textoSuave,
          fontSize: tamano(0.8125),
          fontWeight: 700,
          letterSpacing: '0.01em',
          textTransform: 'none',
          borderBottom: `1px solid ${colores.borde}`,
          whiteSpace: 'nowrap',
          paddingBlock: 12,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${movimiento.rapida} ${movimiento.curva}`,
          '&:last-of-type td': { borderBottom: 'none' },
          '&.MuiTableRow-hover:hover': { backgroundColor: colores.hoverFila },
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
          backgroundColor: colores.superficie,
          color: colores.texto,
          borderRadius: 0,
          borderBottom: `1px solid ${colores.borde}`,
        },
      },
    },

    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: colores.superficie,
          borderRadius: 0,
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
          paddingTop: 8,
          paddingBottom: 8,
          color: colores.textoSuave,
          '& .MuiBottomNavigationAction-label': { fontSize: '0.75rem', fontWeight: 500 },
          '&.Mui-selected': { color: colores.primario },
          '&.Mui-selected .MuiBottomNavigationAction-label': { fontSize: '0.75rem', fontWeight: 700 },
        },
      },
    },

    /* Diálogos: centrados y compactos en escritorio, hoja completa en móvil */
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radios.extra, boxShadow: sombras.alta, backgroundImage: 'none' },
      },
    },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: colores.velo } } },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: tamano(1.25), fontWeight: 600, paddingBottom: 4 } },
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
          backgroundColor: colores.globo,
          color: colores.textoGlobo,
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: radios.chico,
          paddingInline: 10,
          paddingBlock: 6,
        },
        arrow: { color: colores.globo },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radios.medio, alignItems: 'center', boxShadow: sombras.media },
      },
      variants: [
        {
          props: { variant: 'filled', severity: 'success' },
          style: { backgroundImage: degradados.marca, color: colores.textoSobreMarca },
        },
      ],
    },
    MuiSnackbar: { defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'center' } } },

    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: { root: { borderRadius: radios.medio, backgroundColor: colores.esqueleto } },
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


/**
 * Tema final. `responsiveFontSizes` reduce solos los títulos (h1–h6) en pantallas pequeñas:
 * un título de 32 px que luce bien en escritorio ocuparía tres líneas en el teléfono.
 */
export const tema = responsiveFontSizes(temaBase, { breakpoints: ['sm', 'md'], factor: 2.6 })
