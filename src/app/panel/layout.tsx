import PanelChrome from '@/components/PanelChrome'
import { exigirSesion } from '@/lib/auth/guardas'

/**
 * Todas las rutas dentro de /panel pasan por aquí: sin sesión no se llega
 * a ninguna página. Además cada página vuelve a comprobar sus permisos.
 *
 * `instant = false`: la ruta depende de la sesión (cookies), así que se
 * renderiza en cada petición en lugar de prerenderizarse en el build.
 */
export const instant = false

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await exigirSesion()

  return (
    <PanelChrome
      usuario={{
        nombre: usuario.nombre,
        rolNombre: usuario.rolNombre,
        permisos: usuario.permisos,
      }}
    >
      {children}
    </PanelChrome>
  )
}
