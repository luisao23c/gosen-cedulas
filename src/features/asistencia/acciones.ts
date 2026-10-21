'use server'

import { revalidatePath } from 'next/cache'
import { esquemaPaseDeLista, primerError } from '@/lib/validaciones'
import { exigirPermisoAccion } from '@/lib/auth/guardas'
import { guardarPaseDeLista, obtenerPaseDeLista } from '@/lib/db/asistencia'
import { listarIntegrantes } from '@/lib/db/integrantes'
import { ramaDeCelula } from '@/lib/db/ramas'
import type { EstadoFormulario } from '@/features/tipos'
import type { Asistencia } from '@/types/domain'

/**
 * Pase de lista: quién llegó a la reunión de un día.
 *
 * El permiso se comprueba con el ámbito REAL de la célula (`asistencia:pasarLista`)
 * y los integrantes se contrastan contra los de esa célula: un cliente no puede
 * colar la asistencia de alguien que pertenece a otra.
 */

const PREFIJO_ESTADO = 'estado_'

/** Lee del FormData los estados marcados: `estado_<idIntegrante>`. */
function leerAsistencias(formData: FormData): { integranteId: number; estado: string }[] {
  const asistencias: { integranteId: number; estado: string }[] = []
  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith(PREFIJO_ESTADO) || typeof valor !== 'string') continue
    const integranteId = Number(clave.slice(PREFIJO_ESTADO.length))
    if (!Number.isInteger(integranteId) || integranteId <= 0) continue
    asistencias.push({ integranteId, estado: valor })
  }
  return asistencias
}

export async function guardarPaseDeListaAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaPaseDeLista.safeParse({
    celulaId: formData.get('celulaId'),
    fecha: formData.get('fecha'),
    asistencias: leerAsistencias(formData),
  })
  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos.' }
  }

  const ramaId = await ramaDeCelula(datos.data.celulaId)
  if (ramaId == null) return { ok: false, error: 'La célula ya no existe.' }

  const permiso = await exigirPermisoAccion('pasarLista', 'asistencia', {
    ramaId,
    celulaId: datos.data.celulaId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  // Solo se pasa lista a quien pertenece a esta célula
  const integrantes = await listarIntegrantes(permiso.usuario, { celulaId: datos.data.celulaId })
  const permitidos = new Set(integrantes.map((integrante) => integrante.id))
  const ajenos = datos.data.asistencias.filter((asistencia) => !permitidos.has(asistencia.integranteId))
  if (ajenos.length > 0) {
    return { ok: false, error: 'Hay integrantes que no pertenecen a esta célula.' }
  }

  try {
    await guardarPaseDeLista({
      celulaId: datos.data.celulaId,
      fecha: datos.data.fecha,
      asistencias: datos.data.asistencias,
    })
  } catch (error) {
    const codigo = (error as { code?: string } | null)?.code
    if (codigo === 'ER_NO_REFERENCED_ROW_2') return { ok: false, error: 'El integrante ya no existe.' }
    throw error
  }

  revalidatePath(`/panel/celulas/${datos.data.celulaId}`)
  return { ok: true }
}

/**
 * Lo que hay registrado para otra fecha (cuando se cambia el día en la ficha).
 * Devuelve `{ error }` en lugar de redirigir, para que la pantalla lo muestre.
 */
export async function consultarPaseDeListaAccion(datos: { celulaId: number; fecha: string }): Promise<
  { ok: true; reunionId: number | null; asistencias: Asistencia[] } | { ok: false; error: string }
> {
  const parseado = esquemaPaseDeLista
    .pick({ celulaId: true, fecha: true })
    .safeParse({ celulaId: String(datos?.celulaId ?? ''), fecha: datos?.fecha })
  if (!parseado.success) {
    return { ok: false, error: primerError(parseado) ?? 'Fecha no válida.' }
  }

  const ramaId = await ramaDeCelula(parseado.data.celulaId)
  if (ramaId == null) return { ok: false, error: 'La célula ya no existe.' }

  const permiso = await exigirPermisoAccion('ver', 'asistencia', {
    ramaId,
    celulaId: parseado.data.celulaId,
  })
  if ('error' in permiso) return { ok: false, error: permiso.error }

  const pase = await obtenerPaseDeLista(parseado.data.celulaId, parseado.data.fecha)
  return { ok: true, ...pase }
}
