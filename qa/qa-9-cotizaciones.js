// PRUEBA 9: cotizaciones y devolución parcial por peso
//
// El punto central es demostrar que una cotización NO toca el inventario:
// antes, después de cotizar, después de anular y después de vencerse, el stock
// tiene que ser exactamente el mismo. Solo al convertirla se descuenta, y una
// sola vez.

const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

const stockDe = async (S, id) => {
  const r = await S.get('/api/products')
  return r.data.products.find((p) => p.id === id)?.stock
}

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Cotiza ${t}`,
    name: 'Vendedor Cotiza',
    email: `qa_cot_${t}@test.com`,
    password: 'VentoryQA2026',
  })

  const suc = await S.get('/api/branches')
  const branchId = suc.data.branches[0].id

  const prod = await S.post('/api/products', {
    name: `Tornillo ${t}`,
    price: 1500,
    cost: 600,
    branchId,
    initialStock: 100,
  })
  const pid = prod.data.product.id

  const queso = await S.post('/api/products', {
    name: `Queso ${t}`,
    price: 18000,
    cost: 11000,
    branchId,
    initialStock: 20,
    unitOfMeasure: 'kg',
  })
  const qid = queso.data.product.id

  const caja = await S.post('/api/cash-registers/open', { branchId, openingBalance: 100000 })
  const sid = caja.data?.session?.id ?? caja.data?.cashSession?.id

  // ══ COTIZAR NO MUEVE INVENTARIO ══
  const stockAntes = await stockDe(S, pid)
  check('cotizaciones', 'punto de partida: 100 unidades', stockAntes === 100, `${stockAntes}`)

  const cot = await S.post('/api/quotes', {
    branchId,
    customerName: 'Ferretería El Tornillo',
    validDays: 8,
    notes: 'Entrega en 3 días',
    items: [{ productId: pid, quantity: 30, unitPrice: 1500 }],
  })
  check('cotizaciones', 'se emite la cotización', cot.status === 201, `status ${cot.status}`)
  const cotId = cot.data?.quote?.id
  check('cotizaciones', 'lleva número propio COT-', /^COT-\d{6}$/.test(cot.data?.quote?.folio ?? ''), cot.data?.quote?.folio)
  check('cotizaciones', 'calcula el total', cot.data?.quote?.total === 45000, `${cot.data?.quote?.total}`)

  const stockTrasCotizar = await stockDe(S, pid)
  check(
    'cotizaciones',
    'COTIZAR NO DESCUENTA INVENTARIO',
    stockTrasCotizar === 100,
    `quedaron ${stockTrasCotizar}, debían quedar 100`,
  )

  // no consume folio de venta ni movimiento de caja
  const ventasTras = await S.get('/api/sales')
  check('cotizaciones', 'no crea ninguna venta', (ventasTras.data.sales ?? []).length === 0)
  const movTras = await S.get('/api/cash-movements')
  check('cotizaciones', 'no crea movimientos de caja', (movTras.data.movements ?? []).length === 0)
  const kardex = await S.get(`/api/inventory/movements?productId=${pid}`)
  const movsInv = kardex.data?.movements ?? []
  check(
    'cotizaciones',
    'no deja rastro en el kardex',
    !movsInv.some((m) => (m.reason ?? '').toUpperCase().includes('COT')),
    'hay un movimiento con referencia a cotización',
  )

  // ══ SE PUEDE COTIZAR MÁS DE LO QUE HAY ══
  const excesiva = await S.post('/api/quotes', {
    branchId,
    customerName: 'Cliente grande',
    items: [{ productId: pid, quantity: 500, unitPrice: 1500 }],
  })
  check(
    'cotizaciones',
    'se puede cotizar más de lo que hay en bodega',
    excesiva.status === 201,
    `status ${excesiva.status}`,
  )
  check('cotizaciones', 'y el stock sigue intacto', (await stockDe(S, pid)) === 100)
  await S.patch(`/api/quotes/${excesiva.data.quote.id}`, { action: 'cancel' })

  // ══ ANULAR TAMPOCO MUEVE NADA ══
  const paraAnular = await S.post('/api/quotes', {
    branchId,
    customerName: 'Se arrepintió',
    items: [{ productId: pid, quantity: 10, unitPrice: 1500 }],
  })
  const anulada = await S.patch(`/api/quotes/${paraAnular.data.quote.id}`, { action: 'cancel' })
  check('cotizaciones', 'se puede anular', anulada.data?.quote?.status === 'CANCELLED', anulada.data?.quote?.status)
  check('cotizaciones', 'ANULAR NO MUEVE INVENTARIO', (await stockDe(S, pid)) === 100)

  const reanular = await S.patch(`/api/quotes/${paraAnular.data.quote.id}`, { action: 'cancel' })
  check('cotizaciones', 'no se anula dos veces', reanular.status === 400, `status ${reanular.status}`)

  // ══ CONVERTIR: AHÍ SÍ SE DESCUENTA, Y UNA SOLA VEZ ══
  const venta = await S.post('/api/sales', {
    cashSessionId: sid,
    quoteId: cotId,
    items: [{ productId: pid, quantity: 30, unitPrice: 1500 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 45000, card: 0, transfer: 0 },
  })
  check('cotizaciones', 'se convierte en venta', venta.status === 201, `status ${venta.status}`)
  check('cotizaciones', 'el total de la venta es el cotizado', venta.data?.sale?.total === 45000, `${venta.data?.sale?.total}`)
  check(
    'cotizaciones',
    'AL CONVERTIR SÍ SE DESCUENTA (100 − 30 = 70)',
    (await stockDe(S, pid)) === 70,
    `${await stockDe(S, pid)}`,
  )

  const trasConvertir = await S.get(`/api/quotes/${cotId}`)
  check('cotizaciones', 'queda marcada como convertida', trasConvertir.data?.quote?.status === 'CONVERTED')
  check(
    'cotizaciones',
    'queda ligada a la venta que salió de ella',
    trasConvertir.data?.quote?.sale?.folio === venta.data?.sale?.folio,
    `${trasConvertir.data?.quote?.sale?.folio}`,
  )

  // ══ NO SE CONVIERTE DOS VECES ══
  const segunda = await S.post('/api/sales', {
    cashSessionId: sid,
    quoteId: cotId,
    items: [{ productId: pid, quantity: 30, unitPrice: 1500 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 45000, card: 0, transfer: 0 },
  })
  check('cotizaciones', 'NO se puede convertir dos veces', segunda.status === 409, `status ${segunda.status}`)
  check(
    'cotizaciones',
    'y el segundo intento NO descontó inventario (sigue en 70)',
    (await stockDe(S, pid)) === 70,
    `${await stockDe(S, pid)}`,
  )

  const anularConvertida = await S.patch(`/api/quotes/${cotId}`, { action: 'cancel' })
  check('cotizaciones', 'una cotización convertida ya no se anula', anularConvertida.status === 400)

  // ══ CONVERTIR UNA ANULADA TAMPOCO ══
  const deAnulada = await S.post('/api/sales', {
    cashSessionId: sid,
    quoteId: paraAnular.data.quote.id,
    items: [{ productId: pid, quantity: 10, unitPrice: 1500 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 15000, card: 0, transfer: 0 },
  })
  check('cotizaciones', 'no se convierte una cotización anulada', deAnulada.status === 409, `status ${deAnulada.status}`)
  check('cotizaciones', 'y no descontó inventario', (await stockDe(S, pid)) === 70)

  // ══ CONVERTIR UNA COTIZACIÓN QUE NO ALCANZA EN INVENTARIO ══
  // Cotizar 500 teniendo 100 es legítimo (un encargo), pero al cobrarla el
  // sistema tiene que frenar en vez de dejar el inventario en negativo.
  const grande = await S.post('/api/quotes', {
    branchId,
    customerName: 'Pedido grande',
    items: [{ productId: pid, quantity: 500, unitPrice: 1500 }],
  })
  const stockAntesGrande = await stockDe(S, pid)
  const intentoGrande = await S.post('/api/sales', {
    cashSessionId: sid,
    quoteId: grande.data.quote.id,
    items: [{ productId: pid, quantity: 500, unitPrice: 1500 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 750000, card: 0, transfer: 0 },
  })
  check(
    'cotizaciones',
    'convertir más de lo que hay se RECHAZA',
    intentoGrande.status === 422,
    `status ${intentoGrande.status}`,
  )
  check(
    'cotizaciones',
    'el mensaje dice cuánto hay y cuánto se pide',
    /Disponible/.test(intentoGrande.data?.error ?? '') && intentoGrande.data?.code === 'INSUFFICIENT_STOCK',
    intentoGrande.data?.error,
  )
  check(
    'cotizaciones',
    'el inventario NO se movió tras el rechazo',
    (await stockDe(S, pid)) === stockAntesGrande,
    `${stockAntesGrande} → ${await stockDe(S, pid)}`,
  )
  const grandeTras = await S.get(`/api/quotes/${grande.data.quote.id}`)
  check(
    'cotizaciones',
    'la cotización sigue abierta para cobrarla cuando llegue la mercancía',
    grandeTras.data?.quote?.status === 'OPEN',
    grandeTras.data?.quote?.status,
  )
  await S.patch(`/api/quotes/${grande.data.quote.id}`, { action: 'cancel' })

  // ══ DOS CAJAS CONVIRTIENDO LA MISMA COTIZACIÓN A LA VEZ ══
  // Es el caso que descuadraría el inventario: si las dos pasaran, se
  // descontaría el doble por una sola venta real.
  const carrera = await S.post('/api/quotes', {
    branchId,
    customerName: 'Cliente carrera',
    items: [{ productId: pid, quantity: 5, unitPrice: 1500 }],
  })
  const stockAntesCarrera = await stockDe(S, pid)
  const intentos = await Promise.all(
    [1, 2, 3, 4].map(() =>
      S.post('/api/sales', {
        cashSessionId: sid,
        quoteId: carrera.data.quote.id,
        items: [{ productId: pid, quantity: 5, unitPrice: 1500 }],
        paymentMethod: 'CASH',
        payments: { cashActive: true, cashReceived: 7500, card: 0, transfer: 0 },
      }),
    ),
  )
  const exitosas = intentos.filter((r) => r.status === 201).length
  check(
    'cotizaciones',
    'de 4 intentos simultáneos solo UNO se convierte en venta',
    exitosas === 1,
    `${exitosas} ventas creadas`,
  )
  const stockTrasCarrera = await stockDe(S, pid)
  check(
    'cotizaciones',
    'el inventario se descontó una sola vez (5 unidades)',
    stockTrasCarrera === stockAntesCarrera - 5,
    `${stockAntesCarrera} → ${stockTrasCarrera}`,
  )

  // ══ AISLAMIENTO ENTRE NEGOCIOS ══
  const otro = await registerAndLogin(browser, {
    businessName: `QA Cotiza Otro ${t}`,
    name: 'Ajeno',
    email: `qa_cot_otro_${t}@test.com`,
    password: 'VentoryQA2026',
  })
  const ajena = await otro.get(`/api/quotes/${cotId}`)
  check('cotizaciones', 'otro negocio no ve la cotización', ajena.status === 404, `status ${ajena.status}`)
  await otro.ctx.close()

  // ══ VALIDACIONES ══
  const sinItems = await S.post('/api/quotes', { branchId, customerName: 'X', items: [] })
  check('cotizaciones', 'rechaza una cotización sin productos', sinItems.status === 400)

  // ══ DEVOLUCIÓN PARCIAL POR PESO ══
  const ventaQueso = await S.post('/api/sales', {
    cashSessionId: sid,
    items: [{ productId: qid, quantity: 2.5, unitPrice: 18000 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 45000, card: 0, transfer: 0 },
  })
  check('peso', 'se vende 2,5 kg de queso', ventaQueso.status === 201 && ventaQueso.data.sale.total === 45000)
  check('peso', 'el stock baja a 17,5 kg', (await stockDe(S, qid)) === 17.5, `${await stockDe(S, qid)}`)

  const itemQueso = ventaQueso.data.sale.items[0].id
  const dev1 = await S.post(`/api/sales/${ventaQueso.data.sale.id}/return`, {
    items: [{ saleItemId: itemQueso, quantity: 0.8 }],
  })
  check('peso', 'se devuelven 800 gramos', dev1.status === 201, `status ${dev1.status}`)
  check(
    'peso',
    'el reembolso es exacto: 0,8 × 18.000 = 14.400',
    dev1.data?.return?.totalRefund === 14400 || dev1.data?.totalRefund === 14400,
    JSON.stringify(dev1.data).slice(0, 120),
  )
  check('peso', 'el stock sube exactamente 0,8 kg (17,5 → 18,3)', (await stockDe(S, qid)) === 18.3, `${await stockDe(S, qid)}`)

  const dev2 = await S.post(`/api/sales/${ventaQueso.data.sale.id}/return`, {
    items: [{ saleItemId: itemQueso, quantity: 0.7 }],
  })
  check('peso', 'se puede devolver otra parte (700 g más)', dev2.status === 201, `status ${dev2.status}`)
  check('peso', 'el stock acumula bien (18,3 → 19,0)', (await stockDe(S, qid)) === 19, `${await stockDe(S, qid)}`)

  const exceso = await S.post(`/api/sales/${ventaQueso.data.sale.id}/return`, {
    items: [{ saleItemId: itemQueso, quantity: 1.5 }],
  })
  check(
    'peso',
    'NO deja devolver más de lo vendido (quedaba 1 kg, pidió 1,5)',
    exceso.status === 400,
    `status ${exceso.status}`,
  )
  check('peso', 'y el stock no se movió', (await stockDe(S, qid)) === 19, `${await stockDe(S, qid)}`)

  const resto = await S.post(`/api/sales/${ventaQueso.data.sale.id}/return`, {
    items: [{ saleItemId: itemQueso, quantity: 1 }],
  })
  check('peso', 'el kilo que faltaba sí se puede devolver', resto.status === 201, `status ${resto.status}`)
  check('peso', 'el stock vuelve a los 20 kg originales', (await stockDe(S, qid)) === 20, `${await stockDe(S, qid)}`)

  const nadaMas = await S.post(`/api/sales/${ventaQueso.data.sale.id}/return`, {
    items: [{ saleItemId: itemQueso, quantity: 0.1 }],
  })
  check('peso', 'ya no queda nada por devolver', nadaMas.status === 400, `status ${nadaMas.status}`)

  // ══ INTERFAZ ══
  const page = S.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2500)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }

  await page.locator('nav button', { hasText: 'Cotizaciones' }).first().click()
  await page.waitForTimeout(1800)
  const cuerpo = await page.textContent('body')
  check('cotizaciones/ui', 'hay pantalla de Cotizaciones', cuerpo.includes('Cotizaciones'))
  check('cotizaciones/ui', 'aclara que no afectan el inventario', cuerpo.includes('No afectan el inventario'))
  check('cotizaciones/ui', 'muestra la cotización convertida', cuerpo.includes('Convertida'))
  check('cotizaciones/ui', 'muestra la anulada', cuerpo.includes('Anulada'))

  // aviso de faltante al cargar una cotización que no alcanza
  const faltante = await S.post('/api/quotes', {
    branchId,
    customerName: 'Encargo sin stock',
    items: [{ productId: pid, quantity: 999, unitPrice: 1500 }],
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }
  await page.locator('nav button', { hasText: 'Cotizaciones' }).first().click()
  await page.waitForTimeout(1800)
  const listaConFaltante = await page.textContent('body')
  check(
    'cotizaciones/ui',
    'la lista marca las cotizaciones sin inventario suficiente',
    /Falta inventario para/.test(listaConFaltante),
    'no aparece la advertencia',
  )

  await page
    .locator('div', { hasText: faltante.data.quote.folio })
    .locator('button', { hasText: 'Convertir en venta' })
    .first()
    .click()
  await page.waitForTimeout(1800)
  const carritoConFaltante = await page.textContent('body')
  check(
    'cotizaciones/ui',
    'AL CARGARLA avisa que no alcanza el inventario, antes de cobrar',
    carritoConFaltante.includes('No alcanza el inventario'),
    'no aparece el aviso en el carrito',
  )
  check(
    'cotizaciones/ui',
    'el aviso dice cuánto hay y cuánto pide',
    /la cotización pide/.test(carritoConFaltante),
  )

  // al convertir ya quedamos en el punto de venta, que es a pantalla completa
  check('cotizaciones/ui', 'el punto de venta ofrece cotizar', /Cotizar|Ver cotizaciones/.test(carritoConFaltante))
  check('cotizaciones/ui', 'ningún error de JavaScript', errores.length === 0, errores.join(' | '))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
