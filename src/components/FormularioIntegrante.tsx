'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, IconButton, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import PersonAddIcon from '@mui/icons-material/PersonAddOutlined'
import {
  darDeBajaIntegranteAccion,
  editarIntegrante,
  guardarIntegrante,
} from '@/features/integrantes/acciones'
import { ESTADO_INICIAL, type AccionFormulario } from '@/features/tipos'
import AccionPrincipal from '@/components/AccionPrincipal'
import { useAviso } from '@/components/AvisoProvider'
import CamposIntegrante, { type IntegranteInicial } from '@/components/CamposIntegrante'
import DialogoFormulario from '@/components/DialogoFormulario'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'

/**
 * Alta y edición de integrantes de una célula.
 *
 * El diálogo es el compartido (pantalla completa en móvil, centrado en
 * escritorio) y los campos salen de `CamposIntegrante`, que es el mismo que usa
 * el registro por ubicación. La baja se hace desde el propio diálogo: marca
 * INACTIVO en vez de borrar, para no perder el historial de asistencia.
 */
export default function FormularioIntegrante({
  accion,
  celulaId,
  inicial,
  comoBoton = false,
}: {
  accion: 'crear' | 'editar'
  celulaId: number
  inicial?: IntegranteInicial
  /** Botón con texto «Editar» (dentro de la fila del teléfono) en vez del icono */
  comoBoton?: boolean
}) {
  const esEdicion = accion === 'editar'
  const router = useRouter()
  const avisar = useAviso()
  const accionFormulario: AccionFormulario = esEdicion ? editarIntegrante : guardarIntegrante
  const { abierto, abrir, cerrar, error, setError, pendiente, enviar } = useFormularioDialogo(
    accionFormulario,
    esEdicion ? 'Integrante actualizado' : 'Integrante agregado',
  )

  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [dandoDeBaja, iniciarBaja] = useTransition()

  const alAbrir = () => {
    setConfirmandoBaja(false)
    abrir()
  }

  const darDeBaja = () => {
    if (!inicial) return
    iniciarBaja(async () => {
      const datos = new FormData()
      datos.set('id', String(inicial.id))
      const resultado = await darDeBajaIntegranteAccion(ESTADO_INICIAL, datos)
      if (resultado.error) {
        setError(resultado.error)
        setConfirmandoBaja(false)
        return
      }
      cerrar()
      avisar('Integrante dado de baja')
      router.refresh()
    })
  }

  // yaInactivo: no tiene sentido ofrecer la baja dos veces
  const yaInactivo = inicial?.situacion === 'INACTIVO'
  const accionesExtra =
    esEdicion && inicial ? (
      yaInactivo ? (
        <Typography variant="caption" color="text.secondary">
          Este integrante está dado de baja.
        </Typography>
      ) : (
        <Button
          color="error"
          variant={confirmandoBaja ? 'contained' : 'text'}
          disabled={dandoDeBaja || pendiente}
          onClick={() => (confirmandoBaja ? darDeBaja() : setConfirmandoBaja(true))}
        >
          {dandoDeBaja
            ? 'Dando de baja…'
            : confirmandoBaja
              ? 'Toca otra vez para dar de baja'
              : 'Dar de baja'}
        </Button>
      )
    ) : null

  return (
    <>
      {esEdicion && comoBoton ? (
        <Button size="small" startIcon={<EditIcon />} onClick={alAbrir}>
          Editar
        </Button>
      ) : esEdicion ? (
        <Tooltip title="Editar integrante">
          <IconButton color="primary" onClick={alAbrir} aria-label="Editar integrante">
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <AccionPrincipal etiqueta="Nuevo integrante" icono={<PersonAddIcon />} alPulsar={alAbrir} />
      )}

      <DialogoFormulario
        completa
        abierto={abierto}
        titulo={esEdicion ? 'Editar integrante' : 'Nuevo integrante'}
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente || dandoDeBaja}
        error={error}
        anchoMaximo="md"
        accionesExtra={accionesExtra}
      >
        <input type="hidden" name="celulaId" value={celulaId} />
        {esEdicion && inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

        <CamposIntegrante inicial={inicial} />
      </DialogoFormulario>
    </>
  )
}
