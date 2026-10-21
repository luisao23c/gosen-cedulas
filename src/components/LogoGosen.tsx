import Image from 'next/image'

/** Proporción del archivo del logo (423 × 118 px). */
const ANCHO = 423
const ALTO = 118

/**
 * Logo de Gosén (wordmark). Es el único lugar donde se referencian los
 * archivos de `public/marca`.
 *
 *  · `oscuro` → sobre fondos claros (menú, barra superior, login)
 *  · `claro`  → sobre el color de marca (degradado del inicio, banners)
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
  return (
    <Image
      src={variante === 'claro' ? '/marca/gosen-logo-claro.png' : '/marca/gosen-logo.png'}
      alt="Gosén"
      width={ANCHO}
      height={ALTO}
      priority
      style={{ height: alto, width: 'auto', display: 'block' }}
    />
  )
}
