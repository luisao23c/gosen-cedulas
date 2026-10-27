'use client'

import { useState } from 'react'
import { Box, Button, Collapse, Divider, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessIcon from '@mui/icons-material/ExpandLessOutlined'
import type { Integrante } from '@/types/domain'
import CampoUbicacion, { type UbicacionMarcada } from '@/components/CampoUbicacion'

/**
 * Integrante tal como llega del servidor, para editar.
 * El correo no existe en el integrante (MEMORY §7): el contacto por correo es
 * cosa de las cuentas (`usuario`).
 */
export type IntegranteInicial = Omit<Integrante, 'celulaId' | 'creadoEn' | 'actualizadoEn'>

/** Rejilla de dos columnas en escritorio, una en móvil. */
const rejilla = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {titulo}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Box>
  )
}

function CampoFecha({
  name,
  label,
  valor,
  autoFocus,
}: {
  name: string
  label: string
  valor: string | null
  autoFocus?: boolean
}) {
  return (
    <TextField
      name={name}
      label={label}
      type="date"
      defaultValue={valor ?? ''}
      autoFocus={autoFocus}
      slotProps={{ inputLabel: { shrink: true } }}
    />
  )
}

function Interruptor({
  name,
  label,
  marcado,
}: {
  name: string
  label: string
  marcado?: boolean
}) {
  return (
    <FormControlLabel
      control={<Switch name={name} defaultChecked={Boolean(marcado)} />}
      label={label}
    />
  )
}

/**
 * Campos del integrante, compartidos por el formulario de la célula (en
 * diálogo) y el registro por ubicación (en página propia). Así los nombres de
 * los campos y la validación del servidor viven en un solo sitio (§3.5).
 */
export default function CamposIntegrante({
  inicial,
  despuesDeUbicacion,
  alCambiarUbicacion,
  autoenfocarNombre = true,
}: {
  inicial?: IntegranteInicial
  /** Contenido que va justo debajo del mapa (p. ej. la lista de células cercanas) */
  despuesDeUbicacion?: React.ReactNode
  /** Avisa de cada cambio del punto marcado */
  alCambiarUbicacion?: (ubicacion: UbicacionMarcada) => void
  /**
   * Llevar el foco al nombre al abrir. En el registro por ubicación se apaga:
   * el primer paso es marcar el mapa y en móvil el teclado lo taparía.
   */
  autoenfocarNombre?: boolean
}) {
  // «Más datos» arranca cerrado al crear; al editar se abre solo si la persona ya tiene algo ahí
  const tieneMasDatos = Boolean(
    inicial?.origen.ciudad ||
      inicial?.origen.estado ||
      inicial?.hizoEncuentro ||
      inicial?.bautizado ||
      inicial?.notas,
  )
  const [masDatos, setMasDatos] = useState(tieneMasDatos)

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      <Seccion titulo="Datos personales">
        <Box sx={rejilla}>
          <TextField
            name="nombre"
            label="Nombre"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus={!inicial && autoenfocarNombre}
          />
          <TextField
            name="apellidoPaterno"
            label="Apellido paterno"
            defaultValue={inicial?.apellidoPaterno ?? ''}
            required
          />
          <TextField
            name="apellidoMaterno"
            label="Apellido materno (opcional)"
            defaultValue={inicial?.apellidoMaterno ?? ''}
          />
          <TextField name="telefono" label="Teléfono" defaultValue={inicial?.telefono ?? ''} type="tel" />
          <CampoFecha
            name="fechaNacimiento"
            label="Fecha de nacimiento"
            valor={inicial?.fechaNacimiento ?? null}
          />
          {/* Ya no se pregunta: una persona nueva entra como activa y, al editar, conserva la
              situación que tenía (la baja se hace con «Dar de baja»). */}
          <input type="hidden" name="situacion" value={inicial?.situacion ?? 'ACTIVO'} />
        </Box>
      </Seccion>

      <Seccion titulo="Dónde vive">
        <CampoUbicacion
          etiqueta="Ubicación"
          ayuda="Toca el mapa en el punto donde vive la persona. De ahí salen las coordenadas y la dirección."
          inicio={inicial?.ubicacion}
          alCambiar={alCambiarUbicacion}
        />
        {despuesDeUbicacion ? <Box sx={{ mt: 2 }}>{despuesDeUbicacion}</Box> : null}
      </Seccion>

      {/* Lo que casi nunca se llena al registrar a alguien nuevo: plegado, pero sigue en el formulario */}
      <Box>
        <Button
          size="small"
          onClick={() => setMasDatos((valor) => !valor)}
          endIcon={masDatos ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          aria-expanded={masDatos}
        >
          Más datos (origen, encuentro, bautizo, notas)
        </Button>
        <Collapse in={masDatos}>
          <Stack spacing={3} sx={{ pt: 2 }}>
          <Seccion titulo="De dónde es">
            <Box sx={rejilla}>
              <TextField
                name="origenCiudad"
                label="Ciudad de origen"
                defaultValue={inicial?.origen.ciudad ?? ''}
              />
              <TextField
                name="origenEstado"
                label="Estado de origen"
                defaultValue={inicial?.origen.estado ?? ''}
              />
            </Box>
          </Seccion>

          <Seccion titulo="Encuentro y bautizo">
            <Box sx={rejilla}>
              <Interruptor
                name="hizoEncuentro"
                label="Hizo encuentro"
                marcado={inicial?.hizoEncuentro}
              />
              <Interruptor name="bautizado" label="Está bautizado" marcado={inicial?.bautizado} />
              <CampoFecha
                name="fechaEncuentro"
                label="Fecha del encuentro"
                valor={inicial?.fechaEncuentro ?? null}
              />
              <CampoFecha
                name="fechaBautizo"
                label="Fecha del bautizo"
                valor={inicial?.fechaBautizo ?? null}
              />
            </Box>
          </Seccion>

          <Seccion titulo="Notas">
            <Box sx={rejilla}>
              <TextField
                name="notas"
                label="Notas"
                multiline
                minRows={2}
                defaultValue={inicial?.notas ?? ''}
              />
            </Box>
          </Seccion>
          </Stack>
        </Collapse>
      </Box>
    </Stack>
  )
}
