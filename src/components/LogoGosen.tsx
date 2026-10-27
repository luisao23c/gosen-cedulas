import Image from 'next/image'
import { colores } from '@/theme/theme'

/** Proporción del archivo del logo (423 × 118 px). */
const ANCHO = 423
const ALTO = 118

/**
 * Logo de Gosén (wordmark). Es el único lugar donde se referencian los
 * archivos de `public/marca`.
 *
 *  · `oscuro` → sobre las superficies de la app (menú, barra superior, login): en modo claro se ve la
 *    versión de tinta oscura y en modo oscuro la de tinta clara. El CSS elige la versión, así que
 *    no hay destello ni hace falta esperar a JavaScript.
 *  · `claro`  → sobre el color de marca (degradado del inicio, banners): siempre la de tinta clara
 *
 * `alto` es la altura en píxeles CSS; el ancho sale de la proporción.
 */
export default function LogoGosen({
  alto = 22,
  variante = 'oscuro',
}: {
  alto?: number
  variante?: 'oscuro' | 'claro'
}) {
  const imagen = (src: string, display: string) => (
    <Image
      src={src}
      alt={display === 'block' ? 'Gosén' : ''}
      aria-hidden={display === 'block' ? undefined : true}
      width={ANCHO}
      height={ALTO}
      priority
      style={{ height: alto, width: 'auto', display }}
    />
  )

  if (variante === 'claro') return imagen('/marca/gosen-logo-claro.png', 'block')

  return (
    <>
      {imagen('/marca/gosen-logo.png', colores.logoTintaOscura)}
      {imagen('/marca/gosen-logo-claro.png', colores.logoTintaClara)}
    </>
  )
}
