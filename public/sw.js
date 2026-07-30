// Service worker de Ventory — permite abrir la app sin conexión.
//
// Estrategia:
//  · Navegación y recursos estáticos: caché primero con actualización en segundo
//    plano, para que la app cargue aunque no haya internet.
//  · API: siempre red (los datos deben ser frescos). Las respuestas GET de
//    catálogo se guardan como respaldo para poder consultar productos offline.
//  · POST de ventas: si falla por falta de red, el cliente las encola en
//    IndexedDB y las reintenta al volver la conexión (ver offline.ts).

const CACHE = 'ventory-v1'
const SHELL = ['/app', '/login', '/manifest.json', '/brand/ventory-icon.png', '/brand/ventory-logo.png']
// Catálogo consultable sin conexión
const CACHEABLE_API = ['/api/products', '/api/customers', '/api/settings', '/api/categories', '/api/branches']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // API de catálogo: red primero, caché como respaldo sin conexión
  if (CACHEABLE_API.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit ?? Response.json({ error: 'offline' }, { status: 503 }))),
    )
    return
  }

  // Resto del API: siempre red (no se cachea)
  if (url.pathname.startsWith('/api/')) return

  // Navegación y estáticos: caché primero, refresco en segundo plano
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
          return res
        })
        .catch(() => hit ?? caches.match('/app'))
      return hit ?? network
    }),
  )
})
