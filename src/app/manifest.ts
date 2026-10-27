import type { MetadataRoute } from 'next'
import { paletaReal } from '@/theme/theme'

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
    orientation: 'portrait',
    categories: ['productivity', 'lifestyle'],
    // Atajos al mantener pulsado el icono (Android)
    shortcuts: [
      { name: 'Registrar persona', short_name: 'Registrar', url: '/panel/lobby' },
      { name: 'Mi servicio', short_name: 'Mi servicio', url: '/panel/ministerio/mis-turnos' },
      { name: 'Cumpleaños', short_name: 'Cumpleaños', url: '/panel/cumpleanos' },
    ],
    // El manifiesto es estático (no entiende variables CSS ni modos): va el modo claro de la marca
    background_color: paletaReal.claro.fondo,
    theme_color: paletaReal.claro.primario,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
