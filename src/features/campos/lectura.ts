import { listarCampos } from '@/lib/db/campos'
import type { CampoDiferenciador, RespuestaCampo } from '@/types/domain'

/**
 * Lectura de las respuestas de los campos diferenciadores tal como llegan del
 * formulario (un control por campo, con nombre `respuesta_<campoId>`).
 *
 * Lo usan el registro de Lobby y la ficha del integrante: los dos formularios
 * pintan los mismos controles y guardan con el mismo criterio. El catálogo se
 * vuelve a leer aquí dentro: lo que el cliente mandó no decide nada, solo el
 * tipo del campo y sus límites.
 */

export type LecturaRespuestas =
  | { respuestas: RespuestaCampo[] }
  | { error: string }

/** Devuelve las respuestas válidas o el motivo por el que no se pueden guardar. */
export async function leerRespuestasDelFormulario(
  formData: FormData,
): Promise<LecturaRespuestas> {
  const campos = await listarCampos(true)
  const respuestas: RespuestaCampo[] = []

  for (const campo of campos) {
    const crudo = formData.get(`respuesta_${campo.id}`)
    const texto = crudo == null ? '' : String(crudo).trim()
    if (texto === '') continue // sin respuesta: no se guarda nada (no se borra lo anterior en edición)

    if (campo.tipo === 'SELECT') {
      const opcionId = Number(texto)
      const valida = campo.opciones.some((opcion) => opcion.id === opcionId)
      if (!valida) return { error: `${campo.nombre}: esa opción ya no existe.` }
      respuestas.push({ campoId: campo.id, opcionId, valor: null })
      continue
    }

    const valor = Number(texto)
    if (!Number.isInteger(valor)) {
      return { error: `${campo.nombre}: el valor debe ser un número entero.` }
    }
    if (campo.limiteInferior != null && valor < campo.limiteInferior) {
      return { error: `${campo.nombre}: no puede ser menor que ${campo.limiteInferior}.` }
    }
    if (campo.limiteSuperior != null && valor > campo.limiteSuperior) {
      return { error: `${campo.nombre}: no puede ser mayor que ${campo.limiteSuperior}.` }
    }
    respuestas.push({ campoId: campo.id, opcionId: null, valor })
  }

  return { respuestas }
}

/** ¿Hay campos activos en el catálogo? Para no pintar secciones vacías. */
export async function hayCamposActivos(): Promise<boolean> {
  const campos = await listarCampos(true)
  return campos.length > 0
}

/** Campos activos con sus opciones (lo que pintan los formularios). */
export async function camposParaFormulario(): Promise<CampoDiferenciador[]> {
  return listarCampos(true)
}
