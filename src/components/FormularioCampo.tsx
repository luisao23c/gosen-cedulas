'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import AddIcon from '@mui/icons-material/AddOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import { borrarCampoAccion, editarCampoAccion, guardarCampoAccion } from '@/features/campos/acciones'
import { ESTADO_INICIAL, type AccionFormulario } from '@/features/tipos'
import AccionPrincipal from '@/components/AccionPrincipal'
import { useAviso } from '@/components/AvisoProvider'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'
import { ETIQUETAS_TIPO_CAMPO, TIPOS_CAMPO, type CampoDiferenciador, type TipoCampo } from '@/types/domain'

/**
 * Alta y edición de los campos del catálogo («Estado civil», «Edad»…).
 *
 * El tipo se elige aquí y decide lo demás: un campo SELECT trae su editor de
 * opciones y un RANGO trae unidad y límites. Las opciones viajan al servidor
 * como varias entradas `opciones` (una por renglón).
 *
 * En edición, el pie del diálogo lleva la baja. Un campo con respuestas no se
 * borra (se llevaría lo contestado): el servidor lo rechaza y propone
 * desactivarlo con el interruptor.
 */
export default function FormularioCampo({
  accion,
  inicial,
  puedeEliminar = false,
}: {
  accion: 'crear' | 'editar'
  inicial?: CampoDiferenciador
  /** El catálogo solo lo borra quien puede `campo:eliminar` */
  puedeEliminar?: boolean
}) {
  const esEdicion = accion === 'editar'
  const router = useRouter()
  const avisar = useAviso()
  const accionFormulario: AccionFormulario = esEdicion ? editarCampoAccion : guardarCampoAccion
  const { abierto, abrir, cerrar, error, setError, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Filtro actualizado' : 'Filtro creado',
  )

  /** Opciones del formulario; al crear se ofrecen dos renglones vacíos. */
  const opcionesDe = (campo: CampoDiferenciador | undefined) =>
    campo
      ? campo.opciones.map((opcion, indice) => ({ clave: indice, texto: opcion.etiqueta }))
      : [
          { clave: 0, texto: '' },
          { clave: 1, texto: '' },
        ]

  const [tipo, setTipo] = useState<TipoCampo>(inicial?.tipo ?? 'SELECT')
  const [opciones, setOpciones] = useState<{ clave: number; texto: string }[]>(opcionesDe(inicial))
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [dandoDeBaja, iniciarBaja] = useTransition()

  /** El diálogo vuelve a abrirse con lo guardado: no arrastra lo escrito antes. */
  const alAbrir = () => {
    setTipo(inicial?.tipo ?? 'SELECT')
    setOpciones(opcionesDe(inicial))
    setConfirmandoBaja(false)
    abrir()
  }

  const darDeBaja = () => {
    if (!inicial) return
    iniciarBaja(async () => {
      const datos = new FormData()
      datos.set('id', String(inicial.id))
      const resultado = await borrarCampoAccion(ESTADO_INICIAL, datos)
      if (resultado.error) {
        setError(resultado.error)
        setConfirmandoBaja(false)
        return
      }
      cerrar()
      avisar('Filtro eliminado del catálogo')
      router.refresh()
    })
  }

  const accionesExtra =
    esEdicion && puedeEliminar && inicial ? (
      <Button
        color="error"
        variant={confirmandoBaja ? 'contained' : 'text'}
        disabled={pendiente || dandoDeBaja}
        onClick={() => (confirmandoBaja ? darDeBaja() : setConfirmandoBaja(true))}
      >
        {dandoDeBaja
          ? 'Eliminando…'
          : confirmandoBaja
            ? 'Toca otra vez para eliminar'
            : 'Eliminar filtro'}
      </Button>
    ) : null

  return (
    <>
      {esEdicion ? (
        <Tooltip title="Editar filtro">
          <IconButton color="primary" onClick={alAbrir} aria-label="Editar filtro">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo filtro" icono={<AddIcon />} alPulsar={alAbrir} />
      )}

      <DialogoFormulario
        abierto={abierto}
        titulo={esEdicion ? 'Editar filtro' : 'Nuevo filtro'}
        descripcion="La pregunta que las células usan para decir a quién les sirve."
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente || dandoDeBaja}
        error={error}
        anchoMaximo="sm"
        accionesExtra={accionesExtra}
      >
        {esEdicion && inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            name="nombre"
            label="Nombre del filtro"
            defaultValue={inicial?.nombre ?? ''}
            required
            autoFocus
            placeholder="Ej.: Estado civil, Edad, Nivel de estudio…"
          />

          <TextField
            select
            name="tipo"
            label="Tipo de respuesta"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TipoCampo)}
            helperText="De aquí sale la forma en que se responde."
          >
            {TIPOS_CAMPO.map((opcion) => (
              <MenuItem key={opcion} value={opcion}>
                {ETIQUETAS_TIPO_CAMPO[opcion]}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            name="descripcion"
            label="Descripción (opcional)"
            defaultValue={inicial?.descripcion ?? ''}
            multiline
            minRows={2}
            placeholder="Para qué sirve este filtro al recomendar una célula"
          />

          {tipo === 'SELECT' ? (
            <Box>
              <Typography variant="overline" color="text.secondary">
                Opciones para elegir
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              <Stack spacing={1.5}>
                {opciones.map((opcion, indice) => (
                  <Stack key={opcion.clave} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <TextField
                      name="opciones"
                      label={`Opción ${indice + 1}`}
                      value={opcion.texto}
                      onChange={(evento) =>
                        setOpciones((previas) =>
                          previas.map((anterior, posicion) =>
                            posicion === indice ? { ...anterior, texto: evento.target.value } : anterior,
                          ),
                        )
                      }
                      sx={{ flex: 1 }}
                    />
                    <Tooltip title="Quitar opción">
                      <span>
                        <IconButton
                          aria-label={`Quitar opción ${indice + 1}`}
                          color="error"
                          disabled={opciones.length <= 1}
                          onClick={() =>
                            setOpciones((previas) => previas.filter((_, posicion) => posicion !== indice))
                          }
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
              <Button
                size="small"
                startIcon={<AddIcon />}
                sx={{ mt: 1.5 }}
                onClick={() =>
                  setOpciones((previas) => [
                    ...previas,
                    { clave: Number(`${Date.now()}${previas.length}`), texto: '' },
                  ])
                }
              >
                Agregar opción
              </Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              <TextField
                name="unidad"
                label="Unidad (opcional)"
                defaultValue={inicial?.unidad ?? ''}
                placeholder="años, cm, hijos…"
                helperText="Lo que se mide; se muestra junto al número."
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  name="limiteInferior"
                  label="Límite menor (opcional)"
                  type="number"
                  defaultValue={inicial?.limiteInferior ?? ''}
                  sx={{ flex: 1 }}
                />
                <TextField
                  name="limiteSuperior"
                  label="Límite mayor (opcional)"
                  type="number"
                  defaultValue={inicial?.limiteSuperior ?? ''}
                  sx={{ flex: 1 }}
                />
              </Stack>
            </Stack>
          )}

          {esEdicion ? (
            <FormControlLabel
              control={<Switch name="activo" defaultChecked={inicial?.activo ?? true} />}
              label="Filtro activo (aparece en Lobby y en las fichas)"
            />
          ) : null}
        </Stack>
      </DialogoFormulario>
    </>
  )
}
