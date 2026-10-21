'use server'

import { revalidatePath } from 'next/cache'
import {
  esquemaCampo,
  esquemaCampoEdicion,
  esquemaCriteriosCelula,
  primerError,
} from '@/lib/validaciones'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import { ramaDeCelula } from '@/lib/db/ramas'
import {
  actualizarCampo,
  borrarCampo,
  contarUsosCampo,
  guardarCampo,
  guardarCriterios,
  listarCampos,
} from '@/lib/db/campos'
import type { EstadoFormulario } from '@/features/tipos'
import type { CriterioCelula } from '@/types/domain'

function errorDeMySQL(error: unknown): string | null {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === 'ER_DUP_ENTRY') return 'Ya existe un campo con ese nombre.'
  if (codigo === 'ER_NO_REFERENCED_ROW_2') return 'Ese campo ya no existe.'
  return null
}

/**
 * Las opciones llegan como varias entradas `opciones` (una por renglón del
 * editor); los renglones vacíos se descartan antes de validar.
 */
function leerOpciones(formData: FormData): string[] {
  return formData
    .getAll('opciones')
    .map((valor) => String(valor).trim())
    .filter((valor) => valor !== '')
}

/* ─────────────── Catálogo de campos ─────────────── */

export async function guardarCampoAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const permiso = await exigirPermisoAccion('crear', 'campo')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const datos = esquemaCampo.safeParse({
    nombre: formData.get('nombre'),
    tipo: formData.get('tipo'),
    descripcion: formData.get('descripcion'),
    unidad: formData.get('unidad'),
    limiteInferior: formData.get('limiteInferior'),
    limiteSuperior: formData.get('limiteSuperior'),
    opciones: leerOpciones(formData),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  try {
    await guardarCampo({ ...datos.data, activo: true })
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  revalidatePath('/panel/campos')
  revalidatePath('/panel/lobby')
  return { ok: true }
}

export async function editarCampoAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const permiso = await exigirPermisoAccion('editar', 'campo')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const datos = esquemaCampoEdicion.safeParse({
    id: formData.get('id'),
    activo: formData.get('activo'),
    nombre: formData.get('nombre'),
    tipo: formData.get('tipo'),
    descripcion: formData.get('descripcion'),
    unidad: formData.get('unidad'),
    limiteInferior: formData.get('limiteInferior'),
    limiteSuperior: formData.get('limiteSuperior'),
    opciones: leerOpciones(formData),
  })
  if (!datos.success) return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }

  try {
    await actualizarCampo(datos.data.id, datos.data)
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  revalidatePath('/panel/campos')
  revalidatePath('/panel/lobby')
  revalidatePath('/panel/celulas')
  return { ok: true }
}

/**
 * Baja de un campo. Si ya hay respuestas no se borra: se aconseja desactivarlo,
 * porque borraría lo que la gente ya contestó.
 */
export async function borrarCampoAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const permiso = await exigirPermisoAccion('eliminar', 'campo')
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Campo no válido.' }

  const usos = await contarUsosCampo(id)
  if (usos.respuestas > 0) {
    return {
      ok: false,
      error: `Ese campo ya tiene ${usos.respuestas} ${usos.respuestas === 1 ? 'respuesta' : 'respuestas'}. En vez de borrarlo (se llevaría lo contestado), desactívalo desde su edición.`,
    }
  }

  await borrarCampo(id)
  revalidatePath('/panel/campos')
  revalidatePath('/panel/lobby')
  return { ok: true }
}

/* ─────────────── Criterios de cada célula ─────────────── */

/**
 * Lee y valida los criterios de una célula tal como llegan del formulario
 * («Nueva célula», «Editar célula» o la tarjeta de la ficha).
 *
 * EL CATÁLOGO MANDA: el tipo de cada campo, sus opciones y sus límites salen
 * de la base, nunca del cliente — el formulario solo dice qué marcó quien
 * llena. Un campo que ya no existe, una opción que ya no es de ese campo o un
 * rango que se sale de los límites terminan en un `error` legible.
 *
 * Devuelve la lista completa (o vacía, si se desmarcaron todos) lista para
 * `guardarCriterios`, que reemplaza los criterios de la célula entera.
 *
 * `celulaId` llega `null` cuando la célula todavía no existe (acaba de crearse):
 * el id se ata al guardar. En ese caso solo se valida el conjunto de criterios.
 */
export async function leerCriteriosDelFormulario(
  formData: FormData,
  celulaId: number | null,
): Promise<{ criterios: Omit<CriterioCelula, 'celulaId'>[] } | { error: string }> {
  const catalogo = await listarCampos(false)
  const porId = new Map(catalogo.map((campo) => [campo.id, campo]))

  const candidatos = formData
    .getAll('campo')
    .map((valor) => Number(valor))
    .filter((campoId) => Number.isInteger(campoId) && campoId > 0)

  const criterios: Omit<CriterioCelula, 'celulaId'>[] = []
  for (const campoId of Array.from(new Set(candidatos))) {
    const campo = porId.get(campoId)
    if (!campo) {
      return { error: 'Ese campo ya no está en el catálogo.' }
    }

    const marcadas = formData
      .getAll(`opcion_${campoId}`)
      .map((valor) => Number(valor))
      .filter((opcionId) => Number.isInteger(opcionId) && opcionId > 0)
    // Solo se aceptan opciones que sigan siendo del campo (lo demás viene de
    // un formulario viejo o de un dedo largo).
    const validas = marcadas.filter((opcionId) =>
      campo.opciones.some((opcion) => opcion.id === opcionId),
    )

    const crudo = {
      campoId,
      tipo: campo.tipo,
      obligatorio: formData.get(`obligatorio_${campoId}`),
      opcionIds: validas,
      minimo: formData.get(`minimo_${campoId}`),
      maximo: formData.get(`maximo_${campoId}`),
    }

    // El límite del campo también limita el criterio: no se pide «menos de 5»
    // en un campo que solo admite 0 a 120.
    if (campo.tipo === 'RANGO') {
      const minimo = Number(crudo.minimo)
      const maximo = Number(crudo.maximo)
      if (crudo.minimo !== '' && campo.limiteInferior != null && minimo < campo.limiteInferior) {
        return { error: `${campo.nombre}: el límite menor no puede ser menor que ${campo.limiteInferior}.` }
      }
      if (crudo.maximo !== '' && campo.limiteSuperior != null && maximo > campo.limiteSuperior) {
        return { error: `${campo.nombre}: el límite mayor no puede ser mayor que ${campo.limiteSuperior}.` }
      }
      if (
        crudo.minimo !== '' &&
        crudo.maximo !== '' &&
        Number.isFinite(minimo) &&
        Number.isFinite(maximo) &&
        minimo > maximo
      ) {
        return { error: `${campo.nombre}: el límite menor no puede ser mayor que el mayor.` }
      }
    }

    const validacion = esquemaCriteriosCelula.shape.criterios.safeParse([crudo])
    if (!validacion.success) {
      return {
        error: `${campo.nombre}: ${primerError(validacion) ?? 'revisa ese criterio.'}`,
      }
    }
    criterios.push(validacion.data[0])
  }

  if (celulaId != null) {
    const datos = esquemaCriteriosCelula.safeParse({ celulaId, criterios })
    if (!datos.success) return { error: primerError(datos) ?? 'Revisa los criterios.' }
    return { criterios: datos.data.criterios.map((criterio) => ({
      campoId: criterio.campoId,
      obligatorio: criterio.obligatorio,
      opcionIds: criterio.opcionIds,
      minimo: criterio.minimo,
      maximo: criterio.maximo,
    })) }
  }

  // Sin id todavía: cada criterio ya salió validado individualmente arriba.
  return { criterios }
}

/**
 * Reemplaza los criterios de una célula. El permiso se exige con el ámbito
 * REAL de la célula (rama incluida), igual que para editarla.
 */
export async function guardarCriteriosCelula(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const celulaId = Number(formData.get('celulaId'))
  if (!Number.isInteger(celulaId) || celulaId <= 0) {
    return { ok: false, error: 'Célula no válida.' }
  }

  const ramaId = await ramaDeCelula(celulaId)
  if (ramaId == null) return { ok: false, error: 'La célula ya no existe.' }

  const permiso = await exigirPermisoAccion('editar', 'celula', { ramaId, celulaId })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const leidos = await leerCriteriosDelFormulario(formData, celulaId)
  if ('error' in leidos) return { ok: false, error: leidos.error }

  await guardarCriterios(celulaId, leidos.criterios)

  revalidatePath(`/panel/celulas/${celulaId}`)
  revalidatePath('/panel/lobby')
  return { ok: true }
}
