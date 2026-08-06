// Mercado Pago de mentira para pruebas locales: crea "preferencias", sirve un
// checkout mínimo y responde las consultas de pagos que hace el servidor.
//
//   node qa/mercadopago-falso.js       # escucha en 2527
//
// El servidor de Ventory se apunta con MP_API_BASE=http://127.0.0.1:2527 y
// MP_ACCESS_TOKEN=TEST-… (el token de prueba que se quiera).

const http = require('http')

const PORT = Number(process.env.PORT || 2527)
const pagos = new Map() // id → pago simulado
const porReferencia = new Map() // external_reference → [pagos]

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')

    // Crear preferencia (exige el token, como la real)
    if (url.pathname === '/checkout/preferences' && req.method === 'POST') {
      if (!(req.headers.authorization ?? '').startsWith('Bearer TEST-')) {
        return json(res, 401, { error: 'token inválido' })
      }
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const pref = JSON.parse(body)
        const ref = pref.external_reference
        const monto = pref.items?.[0]?.unit_price ?? 0
        json(res, 201, {
          id: `pref-${ref}`,
          init_point: `http://127.0.0.1:${PORT}/co/?reference=${encodeURIComponent(ref)}&monto=${monto}`,
        })
      })
      return
    }

    // Página de checkout simulada
    if (url.pathname === '/co/' || url.pathname === '/co') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<html><body><h1>Checkout Mercado Pago (de mentira)</h1>` +
          `<div id="referencia">${url.searchParams.get('reference') ?? ''}</div>` +
          `<div id="monto">${url.searchParams.get('monto') ?? ''}</div></body></html>`,
      )
      return
    }

    // Búsqueda por referencia (el respaldo sin webhook) — va ANTES que la
    // consulta por id: /v1/payments/search también encaja en esa ruta
    if (url.pathname === '/v1/payments/search' && req.method === 'GET') {
      const lista = porReferencia.get(url.searchParams.get('external_reference')) ?? []
      return json(res, 200, { results: lista })
    }

    // Consulta de un pago por id
    const porId = url.pathname.match(/^\/v1\/payments\/([^/]+)$/)
    if (porId && req.method === 'GET') {
      const p = pagos.get(decodeURIComponent(porId[1]))
      return p ? json(res, 200, p) : json(res, 404, { error: 'not found' })
    }

    // Control de la prueba: registrar el resultado de un pago
    if (url.pathname === '/registrar' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const p = JSON.parse(body)
        pagos.set(String(p.id), p)
        const lista = porReferencia.get(p.external_reference) ?? []
        porReferencia.set(p.external_reference, [...lista, p])
        json(res, 200, { ok: true })
      })
      return
    }

    res.writeHead(404)
    res.end()
  })
  .listen(PORT, () => console.log(`mercadopago-falso escuchando en ${PORT}`))
