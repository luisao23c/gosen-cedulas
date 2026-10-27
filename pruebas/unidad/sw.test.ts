import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

/**
 * El service worker es un archivo suelto de `public/`: se carga en un contexto aislado con un `self`
 * de mentira y se prueban sus funciones directamente.
 */
const CODIGO = readFileSync('public/sw.js', 'utf8')
const ORIGEN = 'https://gosen.example'

interface Peticion {
  method: string
  url: string
  mode: string
}
type Estrategia = (peticion: Peticion, origen: string) => string

function cargar(fetchFalso: (peticion: unknown) => Promise<Response>) {
  const guardados: string[] = []
  const caches = {
    open: async () => ({
      put: async (clave: string) => void guardados.push(clave),
      match: async (clave: string) => (clave === '/offline' ? new Response('pagina-offline') : undefined),
    }),
  }
  const contexto = {
    self: { addEventListener() {}, location: { origin: ORIGEN }, skipWaiting() {}, clients: { claim() {} } },
    caches,
    fetch: fetchFalso,
    URL,
    Response,
    Promise,
    Set,
  } as Record<string, unknown>
  runInNewContext(CODIGO, contexto)
  return {
    estrategia: contexto.estrategia as Estrategia,
    navegar: contexto.navegar as (peticion: Peticion) => Promise<Response>,
    guardados,
  }
}

const peticion = (ruta: string, extra: Partial<Peticion> = {}): Peticion => ({
  method: 'GET',
  url: ORIGEN + ruta,
  mode: 'cors',
  ...extra,
})

describe('service worker · qué se guarda y qué no', () => {
  const { estrategia } = cargar(async () => new Response('ok'))
  const de = (peticionHecha: Peticion) => estrategia(peticionHecha, ORIGEN)

  it('los archivos con huella y el logo se sirven del caché', () => {
    expect(de(peticion('/_next/static/chunks/abc123.js'))).toBe('cache-primero')
    expect(de(peticion('/_next/static/media/fuente.woff2'))).toBe('cache-primero')
    expect(de(peticion('/icons/icon-192.png'))).toBe('revalidar')
    expect(de(peticion('/marca/gosen-logo.png'))).toBe('revalidar')
    expect(de(peticion('/_next/image?url=%2Fmarca%2Fgosen-logo.png&w=1080&q=75'))).toBe('revalidar')
  })

  it('las pantallas van a la red (con página «sin conexión» de respaldo)', () => {
    expect(de(peticion('/panel', { mode: 'navigate' }))).toBe('navegacion')
    expect(de(peticion('/panel/celulas/3', { mode: 'navigate' }))).toBe('navegacion')
  })

  it('NO toca datos privados: RSC, acciones del servidor, API, escrituras ni otros orígenes', () => {
    expect(de(peticion('/panel/celulas?_rsc=1abc'))).toBe('ignorar')
    expect(de(peticion('/panel/usuarios', { method: 'POST' }))).toBe('ignorar')
    expect(de(peticion('/api/salud'))).toBe('ignorar')
    expect(de(peticion('/sw.js'))).toBe('ignorar')
    expect(estrategia({ method: 'GET', url: 'https://tile.openstreetmap.org/12/1/2.png', mode: 'cors' }, ORIGEN)).toBe('ignorar')
    expect(estrategia({ method: 'GET', url: 'https://nominatim.openstreetmap.org/search?q=1', mode: 'cors' }, ORIGEN)).toBe('ignorar')
  })
})

describe('service worker · navegar', () => {
  it('con red devuelve la respuesta de la red y NO guarda nada (el HTML del panel es privado)', async () => {
    const { navegar, guardados } = cargar(async () => new Response('<html>privado</html>'))
    const respuesta = await navegar(peticion('/panel', { mode: 'navigate' }))
    expect(await respuesta.text()).toBe('<html>privado</html>')
    expect(guardados).toEqual([])
  })

  it('sin red muestra la página «sin conexión» guardada', async () => {
    const { navegar } = cargar(async () => {
      throw new TypeError('Failed to fetch')
    })
    const respuesta = await navegar(peticion('/panel', { mode: 'navigate' }))
    expect(await respuesta.text()).toBe('pagina-offline')
  })

  it('un error del servidor (500) no se disfraza de «sin conexión»', async () => {
    const { navegar } = cargar(async () => new Response('fallo', { status: 500 }))
    const respuesta = await navegar(peticion('/panel', { mode: 'navigate' }))
    expect(respuesta.status).toBe(500)
  })
})
