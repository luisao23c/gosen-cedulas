'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Box, Chip } from '@mui/material'
import { rutaConMinisterio } from '@/lib/ministerio'

/** El tema suaviza los chips de color; el filtro elegido tiene que verse sin dudar. */
const estiloActivo = {
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  '&:hover': { bgcolor: 'primary.dark' },
} as const

/**
 * Filtro por ministerio para las pantallas del módulo.
 *
 * Solo se pinta cuando la cuenta ve DOS o más ministerios (una persona que
 * sirve en uno solo no necesita filtrar). Es un enlace por chip: el filtro vive
 * en la URL (`?ministerio=ID`), así se puede compartir y sobrevive al refrescar.
 * En móvil la fila se desliza hacia los lados en vez de partirse en renglones.
 */
export default function FiltroMinisterio({
  ministerios,
  actual,
}: {
  ministerios: { id: number; nombre: string }[]
  actual: number | null
}) {
  const ruta = usePathname()
  if (ministerios.length < 2) return null

  return (
    <Box
      role="group"
      aria-label="Filtrar por ministerio"
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        // Llega hasta el borde de la pantalla en móvil, como las pestañas
        mx: { xs: -2, sm: -3, md: 0 },
        px: { xs: 2, sm: 3, md: 0 },
        py: 0.5,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Chip
        component={Link}
        href={ruta}
        clickable
        label="Todos"
        color={actual == null ? 'primary' : 'default'}
        variant={actual == null ? 'filled' : 'outlined'}
        sx={{ flexShrink: 0, ...(actual == null ? estiloActivo : {}) }}
      />
      {ministerios.map((ministerio) => (
        <Chip
          key={ministerio.id}
          component={Link}
          href={rutaConMinisterio(ruta, ministerio.id)}
          clickable
          label={ministerio.nombre}
          color={actual === ministerio.id ? 'primary' : 'default'}
          variant={actual === ministerio.id ? 'filled' : 'outlined'}
          sx={{ flexShrink: 0, ...(actual === ministerio.id ? estiloActivo : {}) }}
        />
      ))}
    </Box>
  )
}
