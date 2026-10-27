'use client'

import { useSyncExternalStore } from 'react'
import { Alert } from '@mui/material'
import WifiOffIcon from '@mui/icons-material/WifiOffOutlined'

function suscribir(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

/**
 * Aviso fijo arriba del contenido cuando el dispositivo pierde la señal. Es honesto con lo que pasa: se
 * puede seguir viendo lo que ya cargó, pero lo que se capture no se guarda (no hay cola sin conexión).
 */
export default function AvisoSinConexion() {
  // En el servidor siempre «en línea»: así el HTML inicial no cambia y no hay desajuste al hidratar
  const enLinea = useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true,
  )
  if (enLinea) return null

  return (
    <Alert severity="warning" icon={<WifiOffIcon />} role="status" sx={{ mb: 2 }}>
      Sin conexión. Puedes ver lo que ya cargó, pero nada se guardará hasta que vuelva la señal.
    </Alert>
  )
}
