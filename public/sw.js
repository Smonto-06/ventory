// Service worker de Ventory — permite abrir la app sin conexión.
//
// Estrategia:
//  · Navegación y recursos estáticos: RED PRIMERO, con la caché solo como
//    respaldo si no hay conexión. Antes era caché primero con la red
//    refrescando en segundo plano — eso servía SIEMPRE la copia guardada de
//    inmediato, y con la pestaña abierta (o el navegador sin volver a pedir
//    esa URL) un despliegue nuevo podía quedar invisible indefinidamente,
//    aunque el usuario sí tuviera internet.
//  · API: siempre red (los datos deben ser frescas). Las respuestas GET de
//    catálogo se guardan como respaldo para poder consultar productos offline.
//  · POST de ventas, compras y productos nuevos: si falla por falta de red,
//    el cliente los encola en IndexedDB y los reintenta al volver la
//    conexión (ver offline.ts).

const CACHE = 'ventory-v2'
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

  // Navegación y estáticos: red primero — así un despliegue nuevo se ve de
  // inmediato con internet. Si falla (sin conexión), cae a la copia
  // guardada, y si ni eso hay, a la última versión conocida de /app.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match('/app'))),
  )
})
