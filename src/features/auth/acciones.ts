'use server'

import { redirect } from 'next/navigation'
import { esquemaLogin, primerError } from '@/lib/validaciones'
import { buscarCredencial } from '@/lib/db/usuarios'
import { verificarContrasena } from '@/lib/auth/contrasenas'
import { cerrarSesion, crearSesion } from '@/lib/auth/sesion'
import type { EstadoFormulario } from '@/features/tipos'

/**
 * Inicio de sesión.
 * Comprobación contra la base: si el correo no existe o la clave no coincide,
 * el mensaje es el mismo (no se revela cuál de los dos falló).
 */
export async function iniciarSesion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaLogin.safeParse({
    email: formData.get('email'),
    contrasena: formData.get('contrasena'),
  })

  if (!datos.success) {
    return { ok: false, error: primerError(datos) ?? 'Revisa los datos del formulario.' }
  }

  const credencial = await buscarCredencial(datos.data.email)
  const claveCorrecta = credencial
    ? await verificarContrasena(datos.data.contrasena, credencial.contrasenaHash)
    : false

  if (!credencial || !claveCorrecta) {
    return { ok: false, error: 'Correo o contraseña incorrectos.' }
  }

  await crearSesion(credencial)
  redirect('/panel')
}

/** Cierre de sesión (se llama desde un botón, no desde un formulario). */
export async function salir(): Promise<void> {
  await cerrarSesion()
  redirect('/login')
}
