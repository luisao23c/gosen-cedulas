/*
 * Service worker de Gosén — capa SIN CONEXIÓN (solo el armazón).
 *
 * Qué hace:
 *  · Guarda los archivos estáticos de la app (JS, CSS, fuentes, iconos y logo) para que abra rápido.
 *  · Si no hay red al abrir una pantalla, muestra la página «/offline» en lugar del error del navegador.
 *
 * Qué NO hace, a propósito:
 *  · NO guarda páginas ni datos de la sesión (HTML del panel, respuestas RSC, acciones del servidor): hay
 *    información personal y se verían después de cerrar sesión. Las navegaciones siempre van primero a la red.
 *  · NO guarda lo que se capture sin conexión ni lo reenvía después: sin red, nada se guarda.
 *
 * `estrategia` es una función pura para poder probarla sin navegador (pruebas/unidad/sw.test.ts).
 */

const VERSION = 'gosen-v1'
const CACHE_ESTATICOS = `${VERSION}-estaticos`
const CACHE_OFFLINE = `${VERSION}-offline`
const PAGINA_OFFLINE = '/offline'

/** Qué hacer con una petición: 'navegacion' | 'cache-primero' | 'revalidar' | 'ignorar'. */
function estrategia(peticion, origen) {
  if (peticion.method !== 'GET') return 'ignorar'
  const url = new URL(peticion.url)
  // Teselas del mapa, geocodificador… son de otros orígenes: no se tocan
  if (url.origin !== origen) return 'ignorar'
  if (url.pathname.startsWith('/api/')) return 'ignorar'
  if (peticion.mode === 'navigate') return 'navegacion'
  // Archivos con huella en el nombre: nunca cambian, se sirven del caché
  if (url.pathname.startsWith('/_next/static/')) return 'cache-primero'
  // Logo e iconos (públicos): del caché y se actualizan por detrás
  if (url.pathname === '/_next/image' || /^\/(icons|marca)\//.test(url.pathname)) return 'revalidar'
  // Todo lo demás (datos RSC, acciones, etc.) va a la red sin intermediarios
  return 'ignorar'
}

/** Pantallas: siempre la red; solo si no hay red, la página «sin conexión». Nunca se guarda la respuesta. */
async function navegar(peticion) {
  try {
    return await fetch(peticion)
  } catch {
    const cache = await caches.open(CACHE_OFFLINE)
    return (await cache.match(PAGINA_OFFLINE)) ?? Response.error()
  }
}

async function cachePrimero(peticion) {
  const cache = await caches.open(CACHE_ESTATICOS)
  const guardada = await cache.match(peticion)
  if (guardada) return guardada
  const respuesta = await fetch(peticion)
  if (respuesta.ok) await cache.put(peticion, respuesta.clone())
  return respuesta
}

async function revalidar(peticion) {
  const cache = await caches.open(CACHE_ESTATICOS)
  const guardada = await cache.match(peticion)
  const actualizando = fetch(peticion)
    .then(async (respuesta) => {
      if (respuesta.ok) await cache.put(peticion, respuesta.clone())
      return respuesta
    })
    .catch(() => undefined)
  return guardada ?? (await actualizando) ?? Response.error()
}

/**
 * Al instalarse: guarda la página «sin conexión» y todo lo que necesita para verse (JS, CSS y las
 * fuentes que el CSS pide). Si algo falla, no se aborta la instalación: el caché se completa al navegar.
 */
async function precargar() {
  const respuesta = await fetch(PAGINA_OFFLINE, { cache: 'reload' })
  if (!respuesta.ok) return
  const html = await respuesta.clone().text()
  await (await caches.open(CACHE_OFFLINE)).put(PAGINA_OFFLINE, respuesta)

  const estaticos = await caches.open(CACHE_ESTATICOS)
  const hallar = (texto) => [...new Set(texto.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])]
  const recursos = hallar(html)
  await Promise.all(recursos.map((recurso) => estaticos.add(recurso).catch(() => undefined)))

  // Las fuentes no salen en el HTML: las pide el CSS
  for (const hoja of recursos.filter((recurso) => recurso.endsWith('.css'))) {
    try {
      const css = await (await fetch(hoja)).text()
      await Promise.all(
        hallar(css)
          .filter((recurso) => !recurso.endsWith('.css'))
          .map((recurso) => estaticos.add(recurso).catch(() => undefined)),
      )
    } catch {
      /* se completa al navegar */
    }
  }
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(precargar().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((nombre) => !nombre.startsWith(VERSION)).map((nombre) => caches.delete(nombre))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const tipo = estrategia(evento.request, self.location.origin)
  if (tipo === 'navegacion') evento.respondWith(navegar(evento.request))
  else if (tipo === 'cache-primero') evento.respondWith(cachePrimero(evento.request))
  else if (tipo === 'revalidar') evento.respondWith(revalidar(evento.request))
})
