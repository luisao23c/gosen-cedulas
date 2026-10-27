'use client'

import { useSyncExternalStore } from 'react'

const CLAVE = 'gosen_menu_compacto'
const oyentes = new Set<() => void>()

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  window.addEventListener('storage', avisar)
  return () => {
    oyentes.delete(avisar)
    window.removeEventListener('storage', avisar)
  }
}

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

/**
 * Menú lateral contraído (solo iconos) o expandido. Se recuerda en el navegador; sin almacenamiento
 * disponible simplemente no se recuerda. En el servidor siempre es «expandido».
 */
export function useMenuCompacto(): readonly [boolean, () => void] {
  const compacto = useSyncExternalStore(suscribir, leer, () => false)
  const alternar = () => {
    try {
      localStorage.setItem(CLAVE, compacto ? '0' : '1')
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
    oyentes.forEach((avisar) => avisar())
  }
  return [compacto, alternar] as const
}
