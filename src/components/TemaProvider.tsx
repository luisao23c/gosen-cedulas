'use client'

import { CssBaseline, ThemeProvider } from '@mui/material'
import { tema } from '@/theme/theme'

/**
 * El tema de MUI contiene funciones (mezclas de color, etc.), así que no se
 * puede pasar como prop desde un Server Component. Por eso este archivo es de
 * cliente: importa el tema directamente desde el único archivo de diseño
 * (src/theme/theme.ts) y lo reparte a toda la aplicación.
 */
export default function TemaProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
