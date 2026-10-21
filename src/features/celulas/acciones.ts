'use server'

import { revalidatePath } from 'next/cache'
import { esquemaCelula, esquemaCelulaEdicion, primerError } from '@/lib/validaciones'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import { buscarCelula, crearCelula, actualizarCelula, desactivarCelula } from '@/lib/db/celulas'
import { guardarCriterios } from '@/lib/db/campos'
import { leerCriteriosDelFormulario } from '@/features/campos/acciones'
import { ramaDeCelula } from '@/lib/db/ramas'
import type { EstadoFormulario } from '@/features/tipos'
import type { CriterioCelula } from '@/types/domain'

function errorDeMySQL(error: unknown): string | null {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === 'ER_DUP_ENTRY') return 'Esa célula ya existe en la rama.'
  if (codigo === 'ER_NO_REFERENCED_ROW_2') return 'La rama indicada no existe.'
  return null
}

/**
 * ¿El formulario trae el editor de criterios (`EditorCriteriosCelula`)?
 *
 * Es una marca explícita: si no viene, guardar la célula NO toca los criterios
 * que ya tenga declarados. Así una pantalla sin el editor no borra por accidente
 * lo que ya se había configurado.
 */
function traeCriterios(formData: FormData): boolean {
  return formData.get('conCriterios') === '1'
}

/**
 * Lee y valida los criterios marcados en el formulario. Devuelve `null` cuando
 * el formulario no trae editor de criterios: en ese caso guardar la célula NO
 * toca los criterios que ya tenga.
 */
async function criteriosDelFormulario(
  formData: FormData,
): Promise<{ criterios: Omit<CriterioCelula, 'celulaId'>[] } | { error: string } | null> {
  if (!traeCriterios(formData)) return null
  return leerCriteriosDelFormulario(formData, null)
}

export async function guardarCelula(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datosFormulario = {
    ramaId: formData.get('ramaId'),
    nombre: formData.get('nombre'),
    diaSemana: formData.get('diaSemana'),
    hora: formData.get('hora'),
    latitud: formData.get('latitud'),
    longitud: formData.get('longitud'),
    direccion: formData.get('direccion'),
  }
  const datos = esquemaCelula.safeParse(datosFormulario)
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  // El permiso se comprueba con el ámbito REAL de la célula: una célula solo
  // puede crearse dentro de una rama que el usuario administre.
  const permiso = await exigirPermisoAccion('crear', 'celula', { ramaId: datos.data.ramaId })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  // Los criterios se leen ANTES de crear: si un rango se sale de los límites
  // del campo, no se queda una célula creada sin lo que pide.
  const criterios = await criteriosDelFormulario(formData)
  if (criterios && 'error' in criterios) return { ok: false, error: criterios.error }

  let celulaId: number
  try {
    celulaId = await crearCelula(datos.data)
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  if (criterios) await guardarCriterios(celulaId, criterios.criterios)

  revalidatePath('/panel/ramas')
  revalidatePath('/panel/celulas')
  if (criterios) revalidatePath('/panel/lobby')
  return { ok: true }
}

export async function editarCelula(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const celulaId = Number(formData.get('id'))
  if (!Number.isInteger(celulaId) || celulaId <= 0) {
    return { ok: false, error: 'Célula no válida.' }
  }

  // Primero averiguamos en qué rama está, para exigir el permiso con ese ámbito
  const ramaId = await ramaDeCelula(celulaId)
  if (ramaId == null) return { ok: false, error: 'La célula ya no existe.' }

  const datos = esquemaCelulaEdicion.safeParse({
    nombre: formData.get('nombre'),
    diaSemana: formData.get('diaSemana'),
    hora: formData.get('hora'),
    latitud: formData.get('latitud'),
    longitud: formData.get('longitud'),
    direccion: formData.get('direccion'),
    liderId: formData.get('liderId'),
    activa: formData.get('activa') === 'on' ? 'true' : '',
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  const permiso = await exigirPermisoAccion('editar', 'celula', {
    ramaId,
    celulaId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const existente = await buscarCelula(celulaId, permiso.usuario)
  if (!existente) return { ok: false, error: 'La célula ya no existe.' }

  // Igual que al crear: primero se valida todo, después se escribe.
  const criterios = await criteriosDelFormulario(formData)
  if (criterios && 'error' in criterios) return { ok: false, error: criterios.error }

  try {
    await actualizarCelula(celulaId, {
      nombre: datos.data.nombre,
      liderId: datos.data.liderId,
      diaSemana: datos.data.diaSemana,
      hora: datos.data.hora,
      latitud: datos.data.latitud,
      longitud: datos.data.longitud,
      direccion: datos.data.direccion,
      activa: datos.data.activa,
    })
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  // El editor marcado reemplaza el conjunto completo (vaciarlo lo borra todo)
  if (criterios) await guardarCriterios(celulaId, criterios.criterios)

  revalidatePath('/panel/ramas')
  revalidatePath('/panel/celulas')
  revalidatePath(`/panel/ramas/${existente.ramaId}`)
  if (criterios) {
    revalidatePath(`/panel/celulas/${celulaId}`)
    revalidatePath('/panel/lobby')
  }
  return { ok: true }
}

export async function borrarCelula(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const celulaId = Number(formData.get('id'))
  if (!Number.isInteger(celulaId) || celulaId <= 0) {
    return { ok: false, error: 'Célula no válida.' }
  }

  const permiso = await exigirPermisoAccion('eliminar', 'celula', { celulaId })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  await desactivarCelula(celulaId)
  revalidatePath('/panel/ramas')
  return { ok: true }
}
