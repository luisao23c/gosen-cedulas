'use client'

import type { ReactNode } from 'react'
import { Box, Button, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBackOutlined'
import { useTituloDePantalla } from '@/components/CabeceraApp'

/**
 * Cabecera de cada pantalla del panel.
 *
 * Teléfono (patrón «título grande» de las apps nativas): el título se muestra grande
 * al inicio de la pantalla y, al desplazarla, pasa a la barra superior. El botón de
 * volver vive en esa barra (aquí no se repite).
 * Escritorio: migas de vuelta, título, subtítulo y acciones.
 *
 * Registra título y destino de vuelta en la barra (`useTituloDePantalla`).
 */
export default function EncabezadoPagina({
  titulo,
  subtitulo,
  volver,
  children,
}: {
  titulo: string
  subtitulo?: string
  /** Etiqueta corta sobre el título (ya no se pinta; se conserva para no romper las pantallas) */
  etiqueta?: string
  /** Icono de la sección (ya no se pinta: el menú ya lo muestra) */
  icono?: ReactNode
  /** Pantalla de la que se viene */
  volver?: { href: string; etiqueta: string }
  /** Acciones de la cabecera (botones de AccionPrincipal y similares) */
  children?: ReactNode
}) {
  useTituloDePantalla(titulo, volver?.href)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {volver ? (
        // En el teléfono el botón de volver está en la barra superior
        <Button
          href={volver.href}
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{
            display: { xs: 'none', md: 'inline-flex' },
            alignSelf: 'flex-start',
            ml: -1,
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          {volver.etiqueta}
        </Button>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: { md: 'nowrap', xs: 'wrap' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" component="h1" sx={{ mb: 0.25 }}>
            {titulo}
          </Typography>
          {subtitulo ? (
            <Typography variant="body2" color="text.secondary">
              {subtitulo}
            </Typography>
          ) : null}
        </Box>

        {children ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              width: { xs: '100%', md: 'auto' },
            }}
          >
            {children}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
