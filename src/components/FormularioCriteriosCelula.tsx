'use client'

import { Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import DialogoFormulario from '@/components/DialogoFormulario'
import EditorCriteriosCelula from '@/components/EditorCriteriosCelula'
import { useFormularioDialogo } from '@/components/useFormularioDialogo'
import { guardarCriteriosCelula } from '@/features/campos/acciones'
import { etiquetaDeRango, queAcepta } from '@/lib/campos'
import type { CampoDiferenciador, CriterioCelula } from '@/types/domain'
import { radios } from '@/theme/theme'

/**
 * «A quién le sirve esta célula»: la tarjeta de la ficha con el resumen de lo
 * declarado y el botón para cambiarlo. El editor de verdad está en
 * `EditorCriteriosCelula`, que el diálogo de «Nueva célula» reutiliza.
 *
 * Es un botón normal, no un FAB: la pantalla ya tiene el de «Nuevo integrante»
 * (AGENTS.md §3.5, un solo FAB por pantalla).
 */
export default function FormularioCriteriosCelula({
  celulaId,
  campos,
  criterios,
  puedeEditar,
}: {
  celulaId: number
  /** Catálogo activo (lo que se puede pedir) */
  campos: CampoDiferenciador[]
  /** Lo que la célula acepta hoy */
  criterios: CriterioCelula[]
  puedeEditar: boolean
}) {
  const { abierto, abrir, cerrar, error, pendiente, enviar } = useFormularioDialogo(
    guardarCriteriosCelula,
    'Criterios de la célula guardados',
  )

  const porId = new Map(campos.map((campo) => [campo.id, campo]))
  const declarados = criterios
    .map((criterio) => ({ criterio, campo: porId.get(criterio.campoId) }))
    .filter(
      (entrada): entrada is { criterio: CriterioCelula; campo: CampoDiferenciador } =>
        entrada.campo != null,
    )

  // Sin catálogo ni criterios no hay nada que decir: la sección no estorba.
  if (campos.length === 0 && declarados.length === 0) return null

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: `${radios.grande}px` }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h6" component="h2">
            A quién le sirve
          </Typography>
          {puedeEditar ? (
            <Button variant="outlined" startIcon={<TuneIcon />} onClick={abrir}>
              {declarados.length === 0 ? 'Elegir criterios' : 'Cambiar criterios'}
            </Button>
          ) : null}
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Con estas respuestas el registro de Lobby recomienda la célula y explica por qué.
        </Typography>

        <Divider />

        {declarados.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {puedeEditar
              ? 'Esta célula todavía no declara criterios: se recomienda solo por cercanía. Elige qué preguntas del catálogo le importan.'
              : 'Esta célula todavía no declara criterios: se recomienda solo por cercanía.'}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {declarados.map(({ criterio, campo }) => (
              <Stack
                key={criterio.campoId}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {campo.nombre}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {campo.tipo === 'SELECT' ? queAcepta(campo, criterio) : etiquetaDeRango(campo, criterio)}
                </Typography>
                <Chip
                  size="small"
                  color={criterio.obligatorio ? 'primary' : 'default'}
                  label={criterio.obligatorio ? 'Obligatorio' : 'Preferencia'}
                />
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      <DialogoFormulario
        abierto={abierto}
        titulo="A quién le sirve esta célula"
        alCerrar={cerrar}
        alEnviar={enviar}
        pendiente={pendiente}
        error={error}
        anchoMaximo="md"
      >
        <input type="hidden" name="celulaId" value={celulaId} />
        <EditorCriteriosCelula
          campos={campos}
          criterios={criterios}
          titulo="Preguntas que importan"
          descripcion="Marca las preguntas y qué respuestas acepta esta célula."
        />
      </DialogoFormulario>
    </Paper>
  )
}
