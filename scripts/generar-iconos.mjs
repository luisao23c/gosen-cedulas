#!/usr/bin/env node
/**
 * Genera los íconos de la PWA y las variantes del logo a partir de
 * `public/marca/gosen-logo.png` (wordmark oscuro sobre fondo transparente).
 *
 *   npm run iconos
 *
 * Salida:
 *   public/marca/gosen-logo-claro.png   wordmark en Luz Serna, para fondos de marca
 *   public/icons/icon-192.png · icon-512.png · icon-maskable-512.png
 *   src/app/icon.png · src/app/apple-icon.png   (los toma Next solo)
 *
 * El ícono es la «G» del logo sobre el color de marca. Los colores de abajo
 * son los del Manual de Identidad (los mismos de `PALETAS.marca` en el tema).
 */
import sharp from 'sharp'

const ORIGEN = 'public/marca/gosen-logo.png'
const FONDO = '#65362F' // Cherry Mahogany
const TINTA = '#E8E7DF' // Luz Serna

/** Canal alfa del logo como píxeles crudos de 1 canal. */
async function alfaDe(ruta) {
  const { data, info } = await sharp(ruta).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true })
  return { data, ancho: info.width, alto: info.height }
}

/** PNG de un color liso con el alfa dado (así se «tiñe» el logo sin perder sus bordes). */
function teñir(alfa, ancho, alto, color) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: color } })
    .joinChannel(alfa, { raw: { width: ancho, height: alto, channels: 1 } })
    .png()
}

/** Caja que ocupa lo opaco del alfa (para recortar la «G» sin márgenes). */
function caja(alfa, ancho, alto, desde, hasta) {
  let x0 = hasta, x1 = desde, y0 = alto, y1 = 0
  for (let y = 0; y < alto; y++)
    for (let x = desde; x <= hasta; x++)
      if (alfa[y * ancho + x] > 128) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

const { data: alfa, ancho, alto } = await alfaDe(ORIGEN)

// 1) Wordmark claro
await teñir(alfa, ancho, alto, TINTA).toFile('public/marca/gosen-logo-claro.png')

// 2) La «G»: primera letra (columnas 0–90 del wordmark actual)
const g = caja(alfa, ancho, alto, 0, 90)
const alfaG = await sharp(alfa, { raw: { width: ancho, height: alto, channels: 1 } })
  .extract(g)
  .extractChannel(0)
  .raw()
  .toBuffer()

/** Ícono cuadrado: color de marca + «G» a `escala` del lado. El alfa se agranda y se afila para que no quede borroso. */
async function icono(lado, escala, destino) {
  const ladoG = Math.round(lado * escala)
  const relacion = g.width / g.height
  const w = relacion >= 1 ? ladoG : Math.round(ladoG * relacion)
  const h = relacion >= 1 ? Math.round(ladoG / relacion) : ladoG
  const { data: afilado, info } = await sharp(alfaG, { raw: { width: g.width, height: g.height, channels: 1 } })
    .resize(w, h, { kernel: 'lanczos3' })
    .linear(3, -256) // sube el contraste del borde: forma limpia al ampliar
    .blur(0.6)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 1 || afilado.length !== w * h) throw new Error(`alfa inesperado: ${info.channels} canales, ${afilado.length} bytes`)
  const letra = await teñir(afilado, w, h, TINTA).toBuffer()
  await sharp({ create: { width: lado, height: lado, channels: 3, background: FONDO } })
    .composite([{ input: letra, left: Math.round((lado - w) / 2), top: Math.round((lado - h) / 2) }])
    .png()
    .toFile(destino)
}

await icono(192, 0.56, 'public/icons/icon-192.png')
await icono(512, 0.56, 'public/icons/icon-512.png')
// Maskable: el sistema recorta hasta un círculo; la letra se queda en la zona segura (~60 %)
await icono(512, 0.4, 'public/icons/icon-maskable-512.png')
await icono(512, 0.56, 'src/app/icon.png')
await icono(180, 0.56, 'src/app/apple-icon.png')
console.log('Íconos y logo claro generados.')
