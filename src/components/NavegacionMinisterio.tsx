'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Box, Tab, Tabs } from '@mui/material'
import { SECCIONES_MINISTERIO, esSeccionActiva, rutaConMinisterio } from '@/lib/ministerio'
import { alBorde, movimiento, radios } from '@/theme/theme'

/**
 * Sub-navegación del módulo de ministerio.
 *
 * Las secciones las decide el SERVIDOR (`secciones`, calculadas con
 * `lib/ministerio.ts`): así no aparece una pestaña a la que la cuenta no puede
 * entrar. En móvil las pestañas se deslizan hacia los lados en vez de apretarse;
 * el corte lo aplica el CSS del tema, igual que en el resto de la aplicación.
 */
export default function NavegacionMinisterio({
  secciones,
  ministerioId,
}: {
  secciones: string[]
  /** Ministerio elegido en el filtro: se conserva al cambiar de pestaña */
  ministerioId?: number | null
}) {
  const ruta = usePathname()
  const visibles = SECCIONES_MINISTERIO.filter((seccion) => secciones.includes(seccion.ruta))
  const activa = visibles.find((seccion) => esSeccionActiva(ruta, seccion.ruta))?.ruta

  if (visibles.length <= 1) return null

  return (
    <Box
      // Llegan hasta el borde de la pantalla en el teléfono y se deslizan de lado
      sx={alBorde}
    >
      {/* Control segmentado en píldoras (como las apps nativas), no pestañas subrayadas de escritorio */}
      <Tabs
        value={activa ?? false}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 40,
          '& .MuiTabs-flexContainer': { gap: 1 },
          '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTab-root': {
            minHeight: 40,
            minWidth: 0,
            px: 2,
            borderRadius: `${radios.pill}px`,
            color: 'text.secondary',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            fontWeight: 700,
            transition: `background-color ${movimiento.rapida} ${movimiento.curva}, color ${movimiento.rapida} ${movimiento.curva}`,
          },
          '& .MuiTab-root.Mui-selected': {
            color: 'primary.contrastText',
            bgcolor: 'primary.main',
            borderColor: 'primary.main',
          },
        }}
      >
        {visibles.map((seccion) => (
          <Tab
            key={seccion.ruta}
            component={Link}
            href={rutaConMinisterio(seccion.ruta, ministerioId)}
            value={seccion.ruta}
            label={seccion.etiqueta}
            aria-current={esSeccionActiva(ruta, seccion.ruta) ? 'page' : undefined}
          />
        ))}
      </Tabs>
    </Box>
  )
}
