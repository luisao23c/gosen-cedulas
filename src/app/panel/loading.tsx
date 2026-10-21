import { Box, Skeleton, Stack } from '@mui/material'
import { radios } from '@/theme/theme'

/**
 * Esqueleto que se ve al instante mientras el servidor prepara la pantalla:
 * en móvil, con la red lenta, evita la sensación de «no pasó nada» al tocar.
 * Reproduce la forma real (cabecera, buscador y filas) para que el salto al
 * contenido sea suave.
 */
export default function CargandoPanel() {
  return (
    <Stack spacing={3} aria-busy="true" aria-label="Cargando">
      {/* Cabecera de la pantalla */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Skeleton variant="rounded" width={44} height={44} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="rounded" height={22} width="35%" />
          <Skeleton variant="rounded" height={16} width="55%" sx={{ mt: 1 }} />
        </Box>
      </Stack>

      {/* Buscador */}
      <Skeleton variant="rounded" height={44} sx={{ maxWidth: 380 }} />

      {/* Listado */}
      <Stack spacing={1}>
        {[0, 1, 2, 3, 4].map((fila) => (
          <Skeleton
            key={fila}
            variant="rounded"
            height={64}
            sx={{ borderRadius: `${radios.medio}px` }}
          />
        ))}
      </Stack>
    </Stack>
  )
}
