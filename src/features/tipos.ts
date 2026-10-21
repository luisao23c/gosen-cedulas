import type { Alcance } from '@/types/domain'

/** Respuesta estándar de las server actions de formularios. */
export interface EstadoFormulario {
  ok?: boolean
  error?: string
}

/** Estado inicial para `useActionState`. */
export const ESTADO_INICIAL: EstadoFormulario = { ok: false }

/** Firma que deben tener las server actions usadas en formularios. */
export type AccionFormulario = (
  estado: EstadoFormulario,
  formData: FormData,
) => Promise<EstadoFormulario>

/** Usuario reducido, para los desplegables de líderes. */
export interface OpcionUsuario {
  id: number
  nombre: string
  email: string
  rolNombre: string
  alcance: Alcance
}

/** Rama reducida, para desplegables. */
export interface OpcionRama {
  id: number
  nombre: string
}

/** Célula reducida, para desplegables. */
export interface OpcionCelula {
  id: number
  nombre: string
  ramaId: number
}

/** Ministerio reducido, para desplegables (cuentas, equipos y eventos). */
export interface OpcionMinisterio {
  id: number
  nombre: string
}

/** Rol reducido, para el desplegable de cuentas. */
export interface OpcionRol {
  id: number
  nombre: string
  descripcion: string | null
  alcance: Alcance
}
