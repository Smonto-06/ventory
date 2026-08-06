// Wompi de mentira para pruebas locales: sirve un "checkout" mínimo y la
// consulta de transacciones por referencia que usa el respaldo del servidor.
//
//   node qa/wompi-falso.js            # escucha en 2526
//
// El servidor de Ventory se apunta con WOMPI_API_BASE=http://127.0.0.1:2526
// y WOMPI_CHECKOUT_BASE=http://127.0.0.1:2526/p/ — el resto de llaves son
// las de prueba que se le pasen por variables.

const http = require('http')

const PORT = Number(process.env.PORT || 2526)
const transacciones = new Map() // reference → transacción simulada

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')

    // Página de checkout simulada (solo muestra la referencia recibida)
    if (url.pathname === '/p/' || url.pathname === '/p') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<html><body><h1>Checkout Wompi (de mentira)</h1>` +
          `<div id="referencia">${url.searchParams.get('reference') ?? ''}</div>` +
          `<div id="monto">${url.searchParams.get('amount-in-cents') ?? ''}</div></body></html>`,
      )
      return
    }

    // API: consulta por referencia (misma forma que la real)
    if (url.pathname === '/transactions' && req.method === 'GET') {
      const t = transacciones.get(url.searchParams.get('reference'))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: t ? [t] : [] }))
      return
    }

    // Control de la prueba: registrar el resultado de una transacción
    if (url.pathname === '/registrar' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const t = JSON.parse(body)
        transacciones.set(t.reference, t)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"ok":true}')
      })
      return
    }

    res.writeHead(404)
    res.end()
  })
  .listen(PORT, () => console.log(`wompi-falso escuchando en ${PORT}`))
