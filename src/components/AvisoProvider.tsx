'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Alert, Snackbar } from '@mui/material'
import { sobreBarraInferior } from '@/theme/theme'

type TipoAviso = 'success' | 'error' | 'info'
type Mostrar = (mensaje: string, tipo?: TipoAviso) => void

const ContextoAviso = createContext<Mostrar>(() => undefined)

/**
 * Aviso breve («Rol guardado») que confirma que una acción funcionó.
 * Sin esto el diálogo se cierra en silencio y no queda claro si se guardó.
 * En móvil flota por encima de la barra de navegación inferior; en escritorio,
 * separado del borde inferior. Los colores y el radio salen del tema.
 */
export function useAviso(): Mostrar {
  return useContext(ContextoAviso)
}

export default function AvisoProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState<{ mensaje: string; tipo: TipoAviso; clave: number }>({
    mensaje: '',
    tipo: 'success',
    clave: 0,
  })

  const mostrar = useCallback<Mostrar>((mensaje, tipo = 'success') => {
    setAviso({ mensaje, tipo, clave: Date.now() })
    setAbierto(true)
  }, [])

  return (
    <ContextoAviso.Provider value={mostrar}>
      {children}
      <Snackbar
        key={aviso.clave}
        open={abierto}
        autoHideDuration={3500}
        onClose={(_evento, motivo) => {
          if (motivo !== 'clickaway') setAbierto(false)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: `${sobreBarraInferior} !important`, md: '24px !important' } }}
      >
        <Alert
          severity={aviso.tipo}
          variant="filled"
          onClose={() => setAbierto(false)}
          sx={{ width: '100%', maxWidth: 440 }}
        >
          {aviso.mensaje}
        </Alert>
      </Snackbar>
    </ContextoAviso.Provider>
  )
}
