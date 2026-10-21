import type { Metadata, Viewport } from 'next'
import { Inter, Lora, Nunito, Poppins } from 'next/font/google'
import localFont from 'next/font/local'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import TemaProvider from '@/components/TemaProvider'
import { apariencia, colores } from '@/theme/theme'
import './globals.css'

/**
 * Fuentes autoalojadas por Next. Cada una expone una variable CSS que el tema
 * usa en `TIPOGRAFIAS` (src/theme/theme.ts). Solo se aplica la de la tipografía
 * elegida, así el teléfono no descarga las demás.
 */
const inter = Inter({ subsets: ['latin'], variable: '--fuente-inter', display: 'swap' })
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--fuente-poppins',
  display: 'swap',
})
const nunito = Nunito({ subsets: ['latin'], variable: '--fuente-nunito', display: 'swap' })
const lora = Lora({ subsets: ['latin'], variable: '--fuente-lora', display: 'swap' })

/** Tipografías del manual de identidad (archivos en src/fonts). */
const creato = localFont({
  src: [
    { path: '../fonts/creato-display/CreatoDisplay-Regular.otf', weight: '400', style: 'normal' },
    { path: '../fonts/creato-display/CreatoDisplay-RegularItalic.otf', weight: '400', style: 'italic' },
    { path: '../fonts/creato-display/CreatoDisplay-Medium.otf', weight: '500', style: 'normal' },
    { path: '../fonts/creato-display/CreatoDisplay-Bold.otf', weight: '700', style: 'normal' },
    { path: '../fonts/creato-display/CreatoDisplay-ExtraBold.otf', weight: '800', style: 'normal' },
  ],
  variable: '--fuente-creato',
  display: 'swap',
})
const minion = localFont({
  src: [
    { path: '../fonts/minion-pro/MinionPro-Regular.otf', weight: '400', style: 'normal' },
    { path: '../fonts/minion-pro/MinionPro-It.otf', weight: '400', style: 'italic' },
    { path: '../fonts/minion-pro/MinionPro-Medium.otf', weight: '500', style: 'normal' },
    { path: '../fonts/minion-pro/MinionPro-Semibold.otf', weight: '600', style: 'normal' },
    { path: '../fonts/minion-pro/MinionPro-Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--fuente-minion',
  display: 'swap',
})

const FUENTES_POR_TIPOGRAFIA: Record<typeof apariencia.tipografia, string[]> = {
  marca: [minion.variable, creato.variable],
  moderna: [inter.variable],
  amigable: [poppins.variable, nunito.variable],
  editorial: [lora.variable, inter.variable],
  sistema: [],
}

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
    <html lang="es" className={FUENTES_POR_TIPOGRAFIA[apariencia.tipografia].join(' ')}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: false }}>
          <TemaProvider>{children}</TemaProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
