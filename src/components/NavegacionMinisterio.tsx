'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Box, Tab, Tabs } from '@mui/material'
import { SECCIONES_MINISTERIO, esSeccionActiva } from '@/lib/ministerio'
import { movimiento, radios } from '@/theme/theme'

/**
 * Sub-navegación del módulo de ministerio.
 *
 * Las secciones las decide el SERVIDOR (`secciones`, calculadas con
 * `lib/ministerio.ts`): así no aparece una pestaña a la que la cuenta no puede
 * entrar. En móvil las pestañas se deslizan hacia los lados en vez de apretarse;
 * el corte lo aplica el CSS del tema, igual que en el resto de la aplicación.
 */
export default function NavegacionMinisterio({ secciones }: { secciones: string[] }) {
  const ruta = usePathname()
  const visibles = SECCIONES_MINISTERIO.filter((seccion) => secciones.includes(seccion.ruta))
  const activa = visibles.find((seccion) => esSeccionActiva(ruta, seccion.ruta))?.ruta

  if (visibles.length <= 1) return null

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        // Las pestañas llegan hasta el borde de la pantalla en móvil
        mx: { xs: -2, sm: -3, md: 0 },
        px: { xs: 2, sm: 3, md: 0 },
      }}
    >
      <Tabs
        value={activa ?? false}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 44,
          '& .MuiTab-root': {
            minHeight: 44,
            px: { xs: 1.5, md: 2 },
            transition: `color ${movimiento.rapida} ${movimiento.curva}`,
          },
          '& .MuiTabs-indicator': { bgcolor: 'primary.main', borderRadius: `${radios.pill}px` },
        }}
      >
        {visibles.map((seccion) => (
          <Tab
            key={seccion.ruta}
            component={Link}
            href={seccion.ruta}
            value={seccion.ruta}
            label={seccion.etiqueta}
            aria-current={esSeccionActiva(ruta, seccion.ruta) ? 'page' : undefined}
          />
        ))}
      </Tabs>
    </Box>
  )
}
