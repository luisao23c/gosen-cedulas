'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Chip, Stack, Typography } from '@mui/material'
import { alBorde } from '@/theme/theme'

/**
 * Filtros de la lista de usuarios (estilo chips, como en Flutter).
 * El estado vive en la URL (`?rol=<id>&estado=...`), así el filtrado ocurre
 * DENTRO del SQL del servidor: filtrar en el cliente no es filtrar.
 * En móvil cada grupo es una fila que se desliza hacia los lados, para no
 * comerse media pantalla con chips apilados.
 */

const OPCIONES_ESTADO: { valor: string; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'activas', etiqueta: 'Activas' },
  { valor: 'inactivas', etiqueta: 'Desactivadas' },
]

function Grupo({
  titulo,
  opciones,
  actual,
  clave,
  aplicar,
}: {
  titulo: string
  opciones: { valor: string; etiqueta: string }[]
  actual: string
  clave: string
  aplicar: (clave: string, valor: string) => void
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={(tema) => ({
        // El scroll horizontal se aprovecha hasta el borde de la pantalla
        ...alBorde(tema),
        alignItems: 'center',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        flexWrap: { md: 'wrap' },
        rowGap: { md: 1 },
      })}
    >
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44, flexShrink: 0 }}>
        {titulo}
      </Typography>
      {opciones.map((opcion) => {
        const activa = actual === opcion.valor
        return (
          <Chip
            key={opcion.valor || 'todas'}
            label={opcion.etiqueta}
            color={activa ? 'primary' : 'default'}
            variant={activa ? 'filled' : 'outlined'}
            onClick={() => aplicar(clave, opcion.valor)}
            sx={{ flexShrink: 0 }}
          />
        )
      })}
    </Stack>
  )
}

export default function FiltrosUsuarios({
  roles,
}: {
  roles: { id: number; nombre: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const parametros = useSearchParams()
  const rolActual = parametros.get('rol') ?? ''
  const estadoActual = parametros.get('estado') ?? ''

  const aplicar = (clave: string, valor: string) => {
    const siguientes = new URLSearchParams(parametros.toString())
    if (valor) siguientes.set(clave, valor)
    else siguientes.delete(clave)
    const consulta = siguientes.toString()
    router.replace(consulta ? `${pathname}?${consulta}` : pathname, { scroll: false })
  }

  const opcionesRol = [
    { valor: '', etiqueta: 'Todos' },
    ...roles.map((rol) => ({ valor: String(rol.id), etiqueta: rol.nombre })),
  ]

  return (
    <Stack spacing={1}>
      <Grupo titulo="Rol" opciones={opcionesRol} actual={rolActual} clave="rol" aplicar={aplicar} />
      <Grupo
        titulo="Estado"
        opciones={OPCIONES_ESTADO}
        actual={estadoActual}
        clave="estado"
        aplicar={aplicar}
      />
    </Stack>
  )
}
