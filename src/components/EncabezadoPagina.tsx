'use client'

import type { ReactNode } from 'react'
import { Box, Button, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { radios } from '@/theme/theme'

/**
 * Cabecera de cada pantalla del panel.
 *
 * En móvil, cuando la sección ya se llama igual en la barra superior (listados),
 * el título se oculta visualmente (sigue en el DOM como <h1> para lectores de
 * pantalla). En las pantallas de detalle —las que llevan miga de vuelta— sí se
 * muestra, porque la barra superior solo dice la sección, no el objeto.
 * En escritorio siempre muestra icono, título, subtítulo y acciones.
 *
 * `volver` añade la miga de pan de vuelta a la pantalla contenedora (por eso
 * está aquí y no repetida en cada página).
 */
export default function EncabezadoPagina({
  titulo,
  subtitulo,
  etiqueta,
  icono,
  volver,
  children,
}: {
  titulo: string
  subtitulo?: string
  /** Etiqueta corta sobre el título («Estructura», «Organización») */
  etiqueta?: string
  icono?: ReactNode
  /** Enlace a la pantalla de la que se viene */
  volver?: { href: string; etiqueta: string }
  /** Acciones de la cabecera (botones de AccionPrincipal y similares) */
  children?: ReactNode
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {volver ? (
        <Button
          href={volver.href}
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ alignSelf: 'flex-start', ml: -1, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          {icono ? (
            <Box
              aria-hidden
              sx={{
                display: { xs: 'none', md: 'grid' },
                placeItems: 'center',
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: `${radios.grande}px`,
                bgcolor: 'primary.light',
                color: 'primary.dark',
              }}
            >
              {icono}
            </Box>
          ) : null}

          <Box sx={{ minWidth: 0 }}>
            {etiqueta ? (
              <Typography
                variant="overline"
                color="text.secondary"
                sx={(tema) => ({ display: 'none', [tema.breakpoints.up('md')]: { display: 'block' } })}
              >
                {etiqueta}
              </Typography>
            ) : null}
            <Typography
              variant="h4"
              component="h1"
              sx={(tema) =>
                volver
                  ? { mb: 0.25 }
                  : {
                      // Solo para lectores de pantalla (el título ya está en la barra
                      // superior). Ojo: en `sx`, `width: 1` es **100%**, no 1 px —
                      // con eso la caja invisible medía toda la pantalla, desbordaba
                      // a lo ancho y alargaba el scroll en el teléfono.
                      [tema.breakpoints.down('md')]: {
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        p: 0,
                        m: '-1px',
                        overflow: 'hidden',
                        clip: 'rect(0 0 0 0)',
                        clipPath: 'inset(50%)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      },
                    }
              }
            >
              {titulo}
            </Typography>
            {subtitulo ? (
              <Typography variant="body2" color="text.secondary">
                {subtitulo}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {children ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>{children}</Box>
        ) : null}
      </Box>
    </Box>
  )
}
