'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { esquemaLogin, primerError } from '@/lib/validaciones'
import { buscarCredencial } from '@/lib/db/usuarios'
import { gastarTiempoDeVerificacion, verificarContrasena } from '@/lib/auth/contrasenas'
import { ipDeCabeceras, mensajeDeBloqueo } from '@/lib/auth/limite'
import {
  anotarFalloDeLogin,
  clavesDeLogin,
  loginBloqueado,
  olvidarFallosDeLogin,
} from '@/lib/auth/proteccion'
import { cerrarSesion, crearSesion } from '@/lib/auth/sesion'
import type { EstadoFormulario } from '@/features/tipos'

/**
 * Inicio de sesión.
 * Comprobación contra la base: si el correo no existe o la clave no coincide,
 * el mensaje es el mismo (no se revela cuál de los dos falló) y tarda lo mismo.
 * Tras demasiados fallos seguidos del mismo correo o de la misma IP se bloquea un rato
 * (ver `lib/auth/limite.ts`).
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

  const claves = clavesDeLogin(datos.data.email, ipDeCabeceras(await headers()))
  if (await loginBloqueado(claves)) {
    return { ok: false, error: mensajeDeBloqueo() }
  }

  const credencial = await buscarCredencial(datos.data.email)
  let claveCorrecta = false
  if (credencial) {
    claveCorrecta = await verificarContrasena(datos.data.contrasena, credencial.contrasenaHash)
  } else {
    await gastarTiempoDeVerificacion(datos.data.contrasena)
  }

  if (!credencial || !claveCorrecta) {
    await anotarFalloDeLogin(claves)
    return { ok: false, error: 'Correo o contraseña incorrectos.' }
  }

  await olvidarFallosDeLogin(claves)
  await crearSesion(credencial)
  redirect('/panel')
}

/** Cierre de sesión (se llama desde un botón, no desde un formulario). */
export async function salir(): Promise<void> {
  await cerrarSesion()
  redirect('/login')
}
