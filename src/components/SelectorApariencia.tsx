'use client'

import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'

const OPCIONES = [
  { valor: 'system', etiqueta: 'Auto', icono: <SettingsBrightnessIcon fontSize="small" /> },
  { valor: 'light', etiqueta: 'Claro', icono: <LightModeIcon fontSize="small" /> },
  { valor: 'dark', etiqueta: 'Oscuro', icono: <DarkModeIcon fontSize="small" /> },
] as const

/**
 * Elegir el aspecto de la aplicación: Auto (el del dispositivo), Claro u Oscuro.
 * MUI guarda la elección en el navegador y la aplica antes de pintar (ver `layout.tsx`).
 * Hasta que el navegador responde, el modo es desconocido y no se marca ninguna opción.
 */
export default function SelectorApariencia() {
  const { mode, setMode } = useColorScheme()

  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      size="small"
      aria-label="Apariencia"
      value={mode ?? null}
      onChange={(_evento, valor) => {
        if (valor) setMode(valor)
      }}
    >
      {OPCIONES.map((opcion) => (
        <ToggleButton key={opcion.valor} value={opcion.valor} sx={{ gap: 0.75 }}>
          {opcion.icono}
          {opcion.etiqueta}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
