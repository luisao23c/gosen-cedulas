'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Chip, Stack, Typography } from '@mui/material'
import { VENTANAS_CUMPLEANOS, ventanaPedida } from '@/lib/cumpleanos'
import { alBorde } from '@/theme/theme'

/**
 * Ventana del reporte de cumpleaños, en chips.
 *
 * El estado vive en la URL (`?dias=30`) y quien vuelve a calcular el reporte es
 * el servidor: el cliente no filtra nada. En móvil los chips se deslizan hacia
 * los lados para no comerse media pantalla.
 */
export default function FiltrosCumpleanos() {
  const router = useRouter()
  const pathname = usePathname()
  const parametros = useSearchParams()
  const actual = ventanaPedida(parametros.get('dias'))

  const aplicar = (dias: number) => {
    const siguientes = new URLSearchParams(parametros.toString())
    siguientes.set('dias', String(dias))
    router.replace(`${pathname}?${siguientes.toString()}`, { scroll: false })
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={(tema) => ({
        // El scroll horizontal se aprovecha hasta el borde de la pantalla
        ...alBorde(tema),
        alignItems: 'center',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        flexWrap: { md: 'wrap' },
        rowGap: { md: 1 },
      })}
    >
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 52, flexShrink: 0 }}>
        Ventana
      </Typography>
      {VENTANAS_CUMPLEANOS.map((dias) => {
        const activa = actual === dias
        return (
          <Chip
            key={dias}
            label={`${dias} días`}
            color={activa ? 'primary' : 'default'}
            variant={activa ? 'filled' : 'outlined'}
            onClick={() => aplicar(dias)}
            sx={{ flexShrink: 0 }}
          />
        )
      })}
    </Stack>
  )
}
