'use server'

import { revalidatePath } from 'next/cache'
import { esquemaIntegrante, esquemaIntegranteEdicion, primerError } from '@/lib/validaciones'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import {
  actualizarIntegrante,
  celulaDeIntegrante,
  crearIntegrante,
  darDeBajaIntegrante,
} from '@/lib/db/integrantes'
import { ramaDeCelula } from '@/lib/db/ramas'
import { guardarRespuestas } from '@/lib/db/campos'
import { leerRespuestasDelFormulario } from '@/features/campos/lectura'
import type { EstadoFormulario } from '@/features/tipos'

function errorDeMySQL(error: unknown): string | null {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === 'ER_NO_REFERENCED_ROW_2') return 'La célula ya no existe.'
  return null
}

/** Campos del integrante tal como llegan del formulario (todo texto). */
function leerIntegrante(formData: FormData) {
  return {
    nombre: formData.get('nombre'),
    apellidoPaterno: formData.get('apellidoPaterno'),
    apellidoMaterno: formData.get('apellidoMaterno'),
    fechaNacimiento: formData.get('fechaNacimiento'),
    latitud: formData.get('latitud'),
    longitud: formData.get('longitud'),
    direccion: formData.get('direccion'),
    origenCiudad: formData.get('origenCiudad'),
    origenEstado: formData.get('origenEstado'),
    // Los interruptores viajan como 'on' solo si están marcados
    hizoEncuentro: formData.get('hizoEncuentro'),
    fechaEncuentro: formData.get('fechaEncuentro'),
    bautizado: formData.get('bautizado'),
    fechaBautizo: formData.get('fechaBautizo'),
    situacion: formData.get('situacion'),
    telefono: formData.get('telefono'),
    notas: formData.get('notas'),
  }
}

/**
 * Comprueba el permiso con el ÁMBITO REAL del integrante: su rama y su célula.
 * Sin la rama, un rol de alcance de rama no podría tocar ni sus propios datos.
 */
async function exigirAmbitoDeCelula(
  celulaId: number,
  accion: 'crear' | 'editar',
): Promise<{ ramaId: number } | { error: string }> {
  const ramaId = await ramaDeCelula(celulaId)
  if (ramaId == null) return { error: 'La célula ya no existe.' }

  const permiso = await exigirPermisoAccion(accion, 'integrante', { ramaId, celulaId })
  if ('error' in permiso) return { error: permiso.error }
  return { ramaId }
}

function refrescar(celulaId: number, ramaId: number | null): void {
  revalidatePath(`/panel/celulas/${celulaId}`)
  revalidatePath('/panel/celulas')
  if (ramaId != null) revalidatePath(`/panel/ramas/${ramaId}`)
}

/** ¿El formulario trae la sección de campos diferenciadores? */
function trajoRespuestas(formData: FormData): boolean {
  return Array.from(formData.keys()).some((clave) => clave.startsWith('respuesta_'))
}

export async function guardarIntegrante(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaIntegrante.safeParse({
    ...leerIntegrante(formData),
    celulaId: formData.get('celulaId'),
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  const ambito = await exigirAmbitoDeCelula(datos.data.celulaId, 'crear')
  if ('error' in ambito) return { ok: false, error: ambito.error }

  // Las respuestas se leen ANTES de crear: si algo no cuadra, no se queda una
  // persona a medias. Solo se tocan si el formulario las trae.
  const respuestas = trajoRespuestas(formData) ? await leerRespuestasDelFormulario(formData) : null
  if (respuestas && 'error' in respuestas) return { ok: false, error: respuestas.error }

  let integranteId: number
  try {
    integranteId = await crearIntegrante(datos.data)
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  if (respuestas) await guardarRespuestas(integranteId, respuestas.respuestas)

  refrescar(datos.data.celulaId, ambito.ramaId)
  return { ok: true }
}

export async function editarIntegrante(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaIntegranteEdicion.safeParse({
    ...leerIntegrante(formData),
    id: formData.get('id'),
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  // Un integrante no cambia de célula al editarse (regla de negocio 1)
  const celulaId = await celulaDeIntegrante(datos.data.id)
  if (celulaId == null) return { ok: false, error: 'El integrante ya no existe.' }

  const ambito = await exigirAmbitoDeCelula(celulaId, 'editar')
  if ('error' in ambito) return { ok: false, error: ambito.error }

  // En edición, dejar un campo vacío borra su respuesta (se guarda el conjunto completo)
  const respuestas = trajoRespuestas(formData) ? await leerRespuestasDelFormulario(formData) : null
  if (respuestas && 'error' in respuestas) return { ok: false, error: respuestas.error }

  try {
    await actualizarIntegrante(datos.data.id, datos.data)
  } catch (error) {
    const mensaje = errorDeMySQL(error)
    if (mensaje) return { ok: false, error: mensaje }
    throw error
  }

  if (respuestas) await guardarRespuestas(datos.data.id, respuestas.respuestas)

  refrescar(celulaId, ambito.ramaId)
  return { ok: true }
}

/**
 * Baja del integrante: se marca como inactivo y se conserva su historial
 * (MEMORY §4, regla 5: desactivar en lugar de borrar).
 */
export async function darDeBajaIntegranteAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Integrante no válido.' }

  const celulaId = await celulaDeIntegrante(id)
  if (celulaId == null) return { ok: false, error: 'El integrante ya no existe.' }

  const ambito = await exigirAmbitoDeCelula(celulaId, 'editar')
  if ('error' in ambito) return { ok: false, error: ambito.error }

  await darDeBajaIntegrante(id)
  refrescar(celulaId, ambito.ramaId)
  return { ok: true }
}
