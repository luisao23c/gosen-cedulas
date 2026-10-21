import type { Metadata, Viewport } from 'next'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import TemaProvider from '@/components/TemaProvider'
import { colores } from '@/theme/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gosen · Gestión de Células y Ramas',
  description:
    'PWA para gestionar ramas, células, integrantes, pase de lista y cumpleaños.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Permite pintar bajo la muesca/barra del sistema; el panel respeta las zonas seguras
  viewportFit: 'cover',
  themeColor: colores.primario,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: false }}>
          <TemaProvider>{children}</TemaProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
