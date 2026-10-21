import { redirect } from 'next/navigation'
import { getUsuarioActual } from '@/lib/auth/sesion'

/** Raíz: según haya sesión, entra al panel o va al login. */
export const instant = false

export default async function Inicio() {
  const usuario = await getUsuarioActual()
  redirect(usuario ? '/panel' : '/login')
}
