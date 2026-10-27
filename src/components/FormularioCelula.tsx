'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Collapse,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import AddIcon from '@mui/icons-material/AddOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessIcon from '@mui/icons-material/ExpandLessOutlined'
import { guardarCelula, editarCelula } from '@/features/celulas/acciones'
import type { AccionFormulario, OpcionRama, OpcionUsuario } from '@/features/tipos'
import { DIAS_SEMANA, type CampoDiferenciador, type CriterioCelula } from '@/types/domain'
import AccionPrincipal from '@/components/AccionPrincipal'
import CampoUbicacion, { type UbicacionMarcada } from '@/components/CampoUbicacion'
import EditorCriteriosCelula from '@/components/EditorCriteriosCelula'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

interface Inicial {
  id: number
  nombre: string
  diaSemana: number | null
  hora: string | null
  /** Punto donde se reúne la célula */
  ubicacion: UbicacionMarcada
  liderId: number | null
  activa: boolean
}

/**
 * Alta y edición de células. Además de los datos de reunión, la célula se ubica
 * en el mapa: ese punto es el que después permite proponer la célula más
 * cercana a quien se registra por primera vez.
 *
 * Si el llamador trae `campos` y `criterios`, el diálogo incluye también el
 * editor de «A quién le sirve»: así se declaran los criterios EN el mismo alta,
 * sin tener que entrar después a la ficha. Si no se trae, no se pinta nada y
 * guardar no toca los criterios que ya tenga la célula.
 */
export default function FormularioCelula({
  accion,
  ramaId,
  ramas,
  usuarios,
  inicial,
  campos,
  criterios,
}: {
  accion: 'crear' | 'editar'
  ramaId?: number
  ramas?: OpcionRama[]
  usuarios: OpcionUsuario[]
  inicial?: Inicial
  /** Catálogo activo de campos diferenciadores */
  campos?: CampoDiferenciador[]
  /** Lo que la célula acepta hoy (vacío al crear) */
  criterios?: CriterioCelula[]
}) {
  const esEdicion = accion === 'editar'
  const accionFormulario: AccionFormulario = esEdicion ? editarCelula : guardarCelula
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Célula actualizada' : 'Célula creada',
  )

  // «A quién le sirve» es opcional: arranca plegado, salvo que la célula ya declare algo
  const [verCriterios, setVerCriterios] = useState((criterios?.length ?? 0) > 0)

  // Lidera una célula quien tiene un rol con alcance de célula
  const candidatosLider = usuarios.filter((usuario) => usuario.alcance === 'CELULA')

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar célula">
          <IconButton color="primary" onClick={abrir} aria-label="Editar célula">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nueva célula" icono={<AddIcon />} alPulsar={abrir} />
      )}

      <DialogoFormulario
        completa
        abierto={abierto}
        titulo={esEdicion ? 'Editar célula' : 'Nueva célula'}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
        anchoMaximo="md"
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {esEdicion ? <input type="hidden" name="id" value={inicial?.id} readOnly /> : null}
          {ramaId != null ? <input type="hidden" name="ramaId" value={ramaId} readOnly /> : null}

          {!esEdicion && ramaId == null ? (
            <TextField
              select
              name="ramaId"
              label="Rama"
              defaultValue=""
              required
              autoFocus
              helperText="Las células viven dentro de una rama."
            >
              {(ramas ?? []).map((rama) => (
                <MenuItem key={rama.id} value={rama.id}>
                  {rama.nombre}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <TextField
            name="nombre"
            label="Nombre de la célula"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus={esEdicion || ramaId != null}
          />

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              select
              name="diaSemana"
              label="Día de reunión"
              defaultValue={inicial?.diaSemana ?? ''}
            >
              <MenuItem value="">Sin día fijo</MenuItem>
              {DIAS_SEMANA.map((dia, indice) => (
                <MenuItem key={dia} value={indice}>
                  {dia}
                </MenuItem>
              ))}
            </TextField>
  
            <TextField
              name="hora"
              label="Hora"
              type="time"
              defaultValue={inicial?.hora ?? ''}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <CampoUbicacion
            etiqueta="Ubicación de la célula"
            ayuda="Toca el mapa donde se reúne la célula. Con ese punto se le proponen las células más cercanas a quien se registra desde el lobby."
            inicio={inicial?.ubicacion}
          />

          {campos && criterios ? (
            <Box>
              <Button
                size="small"
                onClick={() => setVerCriterios((valor) => !valor)}
                endIcon={verCriterios ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                aria-expanded={verCriterios}
              >
                A quién le sirve (opcional)
              </Button>
              <Collapse in={verCriterios}>
                <Box sx={{ pt: 1.5 }}>
                  <EditorCriteriosCelula campos={campos} criterios={criterios} />
                </Box>
              </Collapse>
            </Box>
          ) : null}

          {esEdicion ? (
            <>
              <TextField
                select
                name="liderId"
                label="Líder de la célula"
                defaultValue={inicial?.liderId ?? ''}
              >
                <MenuItem value="">Sin líder</MenuItem>
                {candidatosLider.map((usuario) => (
                  <MenuItem key={usuario.id} value={usuario.id}>
                    {usuario.nombre} · {usuario.rolNombre}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Switch name="activa" defaultChecked={inicial?.activa ?? true} />}
                label="Célula activa"
              />
            </>
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
