import { describe, expect, it } from 'vitest'
import { colores, degradados, paletaReal } from '@/theme/theme'

/** Luminancia relativa y razón de contraste según WCAG 2.x. */
function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/** `rgba(r, g, b, a)` sobre un fondo hex → hex del color resultante (lo que ve el ojo en un chip tonal). */
function sobre(rgba: string, fondo: string): string {
  const [r, g, b, a] = (rgba.match(/[\d.]+/g) ?? []).map(Number)
  const base = [1, 3, 5].map((i) => Number.parseInt(fondo.slice(i, i + 2), 16))
  const mezcla = [r, g, b].map((c, i) => Math.round(c * a + base[i] * (1 - a)))
  return `#${mezcla.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const AA_TEXTO = 4.5
const MODOS = [
  ['claro', paletaReal.claro],
  ['oscuro', paletaReal.oscuro],
] as const

describe.each(MODOS)('tema %s · contraste del texto (WCAG AA, 4.5:1)', (_nombre, v) => {
  const pares: [string, string, string][] = [
    ['texto sobre el fondo', v.texto, v.fondo],
    ['texto sobre las tarjetas', v.texto, v.superficie],
    ['texto sobre cabeceras de tabla', v.texto, v.superficieAlt],
    ['texto suave sobre las tarjetas', v.textoSuave, v.superficie],
    ['texto suave sobre el fondo', v.textoSuave, v.fondo],
    ['texto de botón principal', v.textoInvertido, v.primario],
    ['color de marca como texto sobre tarjeta', v.primario, v.superficie],
    ['texto de chip de marca', v.primarioOscuro, v.primarioSuave],
    ['texto sobre el acento', v.textoSobreAcento, v.secundario],
    ['texto del globo de ayuda', v.textoGlobo, v.globo],
    ['éxito sobre tarjeta', v.exito, v.superficie],
    ['advertencia sobre tarjeta', v.advertencia, v.superficie],
    ['error sobre tarjeta', v.error, v.superficie],
    // Chips tonales: el texto del estado sobre su propio tinte, encima de una tarjeta
    ['chip de éxito', v.exito, sobre(v.tintes.exito, v.superficie)],
    ['chip de advertencia', v.advertencia, sobre(v.tintes.advertencia, v.superficie)],
    ['chip de error', v.error, sobre(v.tintes.error, v.superficie)],
    ['chip neutro', v.textoSuave, v.superficieMedia],
  ]

  it.each(pares)('%s', (_etiqueta, texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(AA_TEXTO)
  })
})

describe('texto sobre el degradado de marca (igual en los dos modos)', () => {
  it('se lee sobre los dos extremos del degradado', () => {
    const extremos = degradados.marca.match(/#[0-9A-F]{6}/gi) ?? []
    expect(extremos).toHaveLength(2)
    for (const extremo of extremos) {
      expect(contraste(paletaReal.claro.textoSobreMarca, extremo)).toBeGreaterThanOrEqual(AA_TEXTO)
      expect(contraste(paletaReal.oscuro.textoSobreMarca, extremo)).toBeGreaterThanOrEqual(AA_TEXTO)
    }
  })
})

describe('estructura de los dos modos', () => {
  const claves = (objeto: object, prefijo = ''): string[] =>
    Object.entries(objeto).flatMap(([clave, valor]) =>
      typeof valor === 'string' ? [`${prefijo}${clave}`] : claves(valor as object, `${prefijo}${clave}.`),
    )

  it('claro y oscuro definen exactamente los mismos tokens', () => {
    expect(claves(paletaReal.oscuro).sort()).toEqual(claves(paletaReal.claro).sort())
  })

  it('`colores` apunta a una variable CSS por cada token (nada de hex suelto)', () => {
    const referencias = claves(colores).map((clave) => clave.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], colores))
    expect(referencias.length).toBeGreaterThan(20)
    for (const referencia of referencias) expect(referencia).toMatch(/^var\(--g-[\w-]+\)$/)
  })

  it('los colores de los dos modos son hex o rgba válidos (salvo los valores de `display` del logo)', () => {
    for (const [, v] of MODOS) {
      for (const clave of claves(v)) {
        if (clave.startsWith('logoTinta')) continue
        const valor = clave.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], v) as string
        expect(valor, clave).toMatch(/^(#[0-9A-F]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/i)
      }
    }
  })

  it('el logo de tinta oscura y el de tinta clara nunca se ven a la vez', () => {
    for (const [, v] of MODOS) {
      expect([v.logoTintaOscura, v.logoTintaClara].sort()).toEqual(['block', 'none'])
    }
  })
})
