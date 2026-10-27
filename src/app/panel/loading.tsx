import { Box, Skeleton, Stack } from '@mui/material'

/**
 * Esqueleto que se ve al instante mientras el servidor prepara la pantalla:
 * en el teléfono, con la red lenta, evita la sensación de «no pasó nada» al tocar.
 * Reproduce la forma real (título grande, buscador y filas con avatar) para que el
 * salto al contenido sea suave.
 */
export default function CargandoPanel() {
  return (
    <Stack spacing={3} aria-busy="true" aria-label="Cargando">
      {/* Título grande y subtítulo */}
      <Box>
        <Skeleton variant="rounded" height={34} width="42%" />
        <Skeleton variant="rounded" height={16} width="68%" sx={{ mt: 1.5 }} />
      </Box>

      {/* Buscador */}
      <Skeleton variant="rounded" height={52} />

      {/* Filas de lista: avatar + dos líneas */}
      <Stack spacing={2}>
        {[0, 1, 2, 3, 4].map((fila) => (
          <Stack key={fila} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Skeleton variant="circular" width={40} height={40} sx={{ flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="rounded" height={18} width="55%" />
              <Skeleton variant="rounded" height={14} width="80%" sx={{ mt: 1 }} />
            </Box>
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}
