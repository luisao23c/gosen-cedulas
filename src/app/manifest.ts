import type { MetadataRoute } from 'next'
import { colores } from '@/theme/theme'

/**
 * Manifiesto de la PWA: nombre, colores y íconos al instalar la app.
 * Los íconos salen de `npm run iconos` (scripts/generar-iconos.mjs).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gosén · Células y ramas',
    short_name: 'Gosén',
    description: 'Gestión de ramas, células, integrantes, pase de lista, cumpleaños y ministerios.',
    lang: 'es',
    start_url: '/panel',
    scope: '/',
    display: 'standalone',
    background_color: colores.fondo,
    theme_color: colores.primario,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
