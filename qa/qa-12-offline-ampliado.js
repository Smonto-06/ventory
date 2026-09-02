// PRUEBA 12: modo offline ampliado (compras, crédito y crear productos)
//
// Sin internet ya no solo se vende de contado: también se reciben compras,
// se fía y se crean productos. Todo queda en una sola cola (IndexedDB) que
// se envía EN ORDEN al volver la conexión; si un producto se creó offline y
// se vendió offline, primero llega el producto y la venta sale con su id
// real. Cerrar caja sigue exigiendo internet a propósito: el cierre compara
// contra los datos reales del servidor.

const { check, summary, newBrowser, registerAndLogin, loginOnly, BASE, usarTecladoNumerico } = require('./qa-lib')

const colaPendiente = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('ventory-offline')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('operaciones-pendientes', 'readonly')
          const all = tx.objectStore('operaciones-pendientes').getAll()
          all.onsuccess = () => resolve(all.result.map((r) => r.tipo))
          all.onerror = () => resolve(null)
        }
        req.onerror = () => resolve(null)
      }),
  )

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA OfflinePlus ${t}`,
    name: 'Sin Internet',
    email: `qa_offp_${t}@test.com`,
    password: 'VentoryQA2026',
  })
  const branchId = (await S.get('/api/branches')).data.branches[0].id
  const p = await S.post('/api/products', {
    name: `Panela ${t}`,
    price: 4000,
    cost: 2500,
    branchId,
    initialStock: 30,
  })
  const pid = p.data.product.id
  await S.post('/api/customers', { name: `Fiado ${t}` })
  await S.post('/api/cash-registers/open', { branchId, openingBalance: 50000 })
  // Sesión aparte para mirar el servidor mientras la principal está sin red
  const A = await loginOnly(browser, `qa_offp_${t}@test.com`, 'VentoryQA2026')

  const page = S.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(BASE + '/app')
  await page.waitForTimeout(3000)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }

  // ── COMPRA SIN INTERNET ──
  // La compra se arma con conexión; la red se corta justo antes de guardar.
  await page.locator('nav button', { hasText: 'Compras' }).first().click()
  await page.waitForTimeout(1500)
  await page.locator('button:has-text("Nueva compra")').first().click()
  await page.waitForTimeout(1200)
  await page.fill('input[placeholder*="Buscar por nombre"]', `Panela ${t}`)
  await page.waitForTimeout(700)
  await page.locator('main button', { hasText: `Panela ${t}` }).first().click()
  await page.waitForTimeout(600)
  await page.locator('div:has(> label:has-text("Cantidad recibida")) > button').click()
  await page.waitForTimeout(400)
  await usarTecladoNumerico(page, '10')
  await page.waitForTimeout(300)
  await page.locator('button:has-text("Agregar a la compra")').first().click()
  await page.waitForTimeout(500)
  await page.fill('input[placeholder="Escribe el nombre…"]', `Mayorista ${t}`)
  await page.waitForTimeout(300)

  await S.ctx.setOffline(true)
  await page.waitForTimeout(1500)
  check(
    'offline+',
    'el aviso dice que también se puede comprar y crear productos',
    (await page.textContent('body')).includes('comprando y creando productos'),
  )
  await page.locator('button:has-text("Guardar compra")').first().click()
  await page.waitForTimeout(1800)
  const trasCompra = await page.textContent('body')
  check('offline+', 'la compra sin internet avisa que quedó guardada', trasCompra.includes('compra guardada'))

  let cola = await colaPendiente(page)
  check('offline+', 'la compra queda en la cola del dispositivo', cola && cola.length === 1 && cola[0] === 'compra', JSON.stringify(cola))

  // el stock local sube de una para poder vender lo recibido
  await page.locator('nav button', { hasText: 'Productos' }).first().click()
  await page.waitForTimeout(1200)
  await page.fill('input[placeholder*="Buscar"]', `Panela ${t}`)
  await page.waitForTimeout(700)
  check('offline+', 'el stock local sube de una (30 + 10 = 40)', (await page.textContent('body')).includes('40'))

  // ── CREAR PRODUCTO SIN INTERNET ──
  await page.locator('button:has-text("Nuevo producto")').first().click()
  await page.waitForTimeout(700)
  await page.fill('input[placeholder="Ej. Camiseta Estampada M"]', `Aromatica ${t}`)
  await page.locator('div:has(> label:has-text("Precio de venta")) > button').click()
  await page.waitForTimeout(400)
  await usarTecladoNumerico(page, '3000')
  await page.waitForTimeout(300)
  await page.locator('div:has(> label:has-text("Stock inicial")) > button').click()
  await page.waitForTimeout(400)
  await usarTecladoNumerico(page, '5')
  await page.waitForTimeout(300)
  await page.locator('button:has-text("Guardar producto")').first().click()
  await page.waitForTimeout(1500)
  const trasProducto = await page.textContent('body')
  check('offline+', 'el producto sin internet avisa que quedó guardado', trasProducto.includes('producto guardado'))
  await page.fill('input[placeholder*="Buscar"]', `Aromatica ${t}`)
  await page.waitForTimeout(700)
  check('offline+', 'el producto creado offline aparece en la lista', (await page.textContent('body')).includes(`Aromatica ${t}`))

  cola = await colaPendiente(page)
  check('offline+', 'la cola lleva compra + producto, en orden', cola && cola.join(',') === 'compra,producto', JSON.stringify(cola))

  // ── VENDER SIN INTERNET EL PRODUCTO CREADO SIN INTERNET ──
  await page.locator('nav button', { hasText: 'Punto de Venta' }).first().click()
  await page.waitForTimeout(1200)
  await page.fill('input[placeholder*="Buscar"]', `Aromatica ${t}`)
  await page.waitForTimeout(700)
  await page.locator('main button', { hasText: `Aromatica ${t}` }).first().click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(900)
  await page.locator('button:has-text("Efectivo")').first().click()
  await page.waitForTimeout(400)
  await page.locator('button:has-text("Exacto")').first().click()
  await page.waitForTimeout(300)
  await page.locator('button:has-text("Finalizar venta")').first().click()
  await page.waitForTimeout(1500)
  check(
    'offline+',
    'la venta del producto offline queda guardada',
    (await page.textContent('body')).includes('venta guardada'),
  )

  // ── VENTA A CRÉDITO SIN INTERNET ──
  await page.fill('input[placeholder*="Buscar"]', `Panela ${t}`)
  await page.waitForTimeout(700)
  await page.locator('main button', { hasText: `Panela ${t}` }).first().click()
  await page.waitForTimeout(400)
  await page.locator('main button', { hasText: `Panela ${t}` }).first().click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(900)
  await page.locator('button:has-text("Crédito")').first().click()
  await page.waitForTimeout(400)
  await page.locator('button:has-text("Finalizar venta")').first().click()
  await page.waitForTimeout(700)
  await page.locator('button', { hasText: `Fiado ${t}` }).first().click()
  await page.waitForTimeout(1500)
  check(
    'offline+',
    'la venta a crédito sin internet queda guardada',
    (await page.textContent('body')).includes('venta a crédito guardada'),
  )

  cola = await colaPendiente(page)
  check(
    'offline+',
    'la cola completa: compra, producto y 2 ventas, en orden',
    cola && cola.join(',') === 'compra,producto,venta,venta',
    JSON.stringify(cola),
  )

  // mientras tanto el servidor NO se enteró de nada
  const stockServidor = (await A.get('/api/products')).data.products.find((x) => x.id === pid)?.stock
  check('offline+', 'el servidor sigue con el stock original (30)', stockServidor === 30, `${stockServidor}`)

  // ── VUELVE LA CONEXIÓN: TODO SE SINCRONIZA EN ORDEN ──
  await S.ctx.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  let avisoSync = false
  for (let i = 0; i < 16 && !avisoSync; i++) {
    await page.waitForTimeout(500)
    avisoSync = (await page.textContent('body')).includes('Se sincronizó lo guardado sin conexión')
  }
  await page.waitForTimeout(2500)

  cola = await colaPendiente(page)
  check('offline+', 'la cola queda vacía tras sincronizar', cola && cola.length === 0, JSON.stringify(cola))
  check('offline+', 'aparece el aviso de sincronización con el detalle', avisoSync)

  const productos = (await A.get('/api/products')).data.products
  const panela = productos.find((x) => x.id === pid)
  const aromatica = productos.find((x) => x.name === `Aromatica ${t}`)
  check('offline+', 'stock de Panela exacto: 30 + 10 compradas − 2 fiadas = 38', panela?.stock === 38, `${panela?.stock}`)
  check('offline+', 'el producto creado offline existe en el servidor', !!aromatica, 'no llegó')
  check(
    'offline+',
    'el producto llegó con id real (ya no provisional)',
    !!aromatica && !aromatica.id.startsWith('offline-'),
    aromatica?.id,
  )
  check(
    'offline+',
    'la venta offline del producto nuevo descontó su stock (5 − 1 = 4)',
    aromatica?.stock === 4,
    `${aromatica?.stock}`,
  )

  const compras = (await A.get('/api/purchases')).data.purchases
  check('offline+', 'la compra quedó registrada por 10 × $2.500 = $25.000', compras.length === 1 && compras[0].total === 25000, JSON.stringify(compras.map((c) => c.total)))

  const ventas = (await A.get('/api/sales')).data.sales
  check('offline+', 'las 2 ventas offline quedaron en el servidor', ventas.length === 2, `${ventas.length} ventas`)
  const folios = new Set(ventas.map((v) => v.folio))
  check('offline+', 'con folios distintos', folios.size === 2, [...folios].join(','))

  const cli = (await A.get('/api/customers')).data.customers.find((c) => c.name === `Fiado ${t}`)
  check('offline+', 'el fiado subió el saldo del cliente: 2 × $4.000 = $8.000', Number(cli?.balance) === 8000, `${cli?.balance}`)

  // ── CERRAR CAJA SIGUE EXIGIENDO INTERNET (A PROPÓSITO) ──
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2500)
  await S.ctx.setOffline(true)
  await page.waitForTimeout(1000)
  await page.locator('nav button', { hasText: 'Cerrar caja' }).first().click()
  await page.waitForTimeout(1200)
  await page.locator('div:has(> label:has-text("Total contado")) > button').click()
  await page.waitForTimeout(400)
  await usarTecladoNumerico(page, '53000')
  await page.waitForTimeout(300)
  await page.locator('button:has-text("Cerrar caja")').last().click()
  await page.waitForTimeout(800)
  // en el modal, cerrar sin abrir turno nuevo
  await page.locator('button:has-text("Cierre del día")').first().click()
  await page.waitForTimeout(1200)
  check(
    'offline+',
    'cerrar caja sin internet se bloquea con explicación',
    (await page.textContent('body')).includes('Para cerrar caja necesitas internet'),
  )
  await S.ctx.setOffline(false)
  await page.waitForTimeout(500)
  const sesion = (await A.get('/api/cash-registers/current')).data?.session
  check('offline+', 'la caja sigue abierta en el servidor', !!sesion, 'se cerró')

  check('offline+', 'ningún error de JavaScript', errores.length === 0, errores.join(' | ').slice(0, 200))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
