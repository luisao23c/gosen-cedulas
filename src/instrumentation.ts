import type { Instrumentation } from 'next'

/**
 * Registro de errores del servidor, una línea JSON por error.
 *
 * Los proveedores (Vercel, Docker, systemd…) indexan y filtran mejor una línea JSON que un
 * stack suelto. Lleva el `digest`: es el mismo código que ve la persona en la pantalla de error
 * («Código del error»), así quien da soporte encuentra la línea exacta.
 *
 * Solo se registra lo necesario para diagnosticar: la ruta y el tipo de ruta, nunca el cuerpo
 * de la petición, las cookies ni los encabezados (pueden llevar contraseñas o la sesión).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, contexto) => {
  const causa = error instanceof Error ? error : new Error(String(error))
  const digest = (error as { digest?: unknown }).digest

  console.error(
    JSON.stringify({
      nivel: 'error',
      momento: new Date().toISOString(),
      mensaje: causa.message,
      digest: typeof digest === 'string' ? digest : undefined,
      metodo: request.method,
      ruta: request.path,
      tipoDeRuta: contexto.routeType,
      rutaDelCodigo: contexto.routePath,
      pila: causa.stack?.split('\n').slice(0, 6).join('\n'),
    }),
  )
}
