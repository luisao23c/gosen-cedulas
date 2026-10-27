'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker (`public/sw.js`) para que la app abra rápido y, sin red, muestre la página
 * «sin conexión». Solo en producción: en desarrollo un service worker se mete con la recarga en caliente.
 * Si el navegador no lo soporta o el registro falla, la app funciona igual.
 */
export default function RegistroServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
  }, [])
  return null
}
