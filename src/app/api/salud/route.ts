import { connection, NextResponse } from 'next/server'
import { consultarUno } from '@/lib/db/conexion'
import { problemasDeEntorno } from '@/lib/entorno'

/**
 * Salud de la aplicación, para un monitor externo (UptimeRobot, Better Stack…) o el chequeo
 * de la plataforma.
 *
 *   200 → la app responde y la base de datos contesta
 *   503 → la base no contesta o la configuración de producción es insegura
 *
 * Es pública a propósito (el monitor no inicia sesión), así que NO devuelve detalles:
 * ni mensajes de error ni nombres de variables. El detalle queda en el registro del servidor.
 */
export async function GET() {
  // Sin esto Next intentaría preparar la respuesta al compilar y guardaría el resultado de ese momento
  await connection()

  const inicio = performance.now()
  let baseResponde = false
  try {
    await consultarUno('SELECT 1 AS ok')
    baseResponde = true
  } catch (error) {
    console.error(
      JSON.stringify({ nivel: 'error', evento: 'salud', mensaje: 'La base de datos no responde', causa: String(error) }),
    )
  }
  const msBase = Math.round(performance.now() - inicio)

  const problemas = process.env.NODE_ENV === 'production' ? problemasDeEntorno() : []
  if (problemas.length > 0) {
    console.error(JSON.stringify({ nivel: 'error', evento: 'salud', mensaje: 'Configuración insegura', problemas }))
  }

  const sano = baseResponde && problemas.length === 0
  return NextResponse.json(
    {
      estado: sano ? 'ok' : 'degradado',
      base: baseResponde ? 'ok' : 'caida',
      configuracion: problemas.length === 0 ? 'ok' : 'revisar',
      msBase,
      momento: new Date().toISOString(),
    },
    { status: sano ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
