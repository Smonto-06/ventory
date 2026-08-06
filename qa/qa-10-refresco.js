// PRUEBA 10: refresco automático de datos entre dispositivos
//
// Varias personas trabajan a la vez sobre el mismo negocio. El servidor
// siempre tuvo la verdad; lo que se prueba aquí es que la PANTALLA de cada
// uno se pone al día sola, y que hacerlo no le daña el trabajo a nadie:
// el carrito a medio armar y lo digitado deben sobrevivir al refresco.
//
// Para no esperar los 30 s del ciclo, las pruebas disparan el evento
// 'online', que ejecuta el mismo refresco inmediatamente.

const { check, summary, newBrowser, registerAndLogin, loginOnly, BASE } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const admin = await registerAndLogin(browser, {
    businessName: `QA Refresco ${t}`,
    name: 'Dueño Refresco',
    email: `qa_ref_${t}@test.com`,
    password: 'VentoryQA2026',
  })
  const branchId = (await admin.get('/api/branches')).data.branches[0].id
  const p = await admin.post('/api/products', {
    name: `Cafe ${t}`,
    price: 12000,
    cost: 8000,
    branchId,
    initialStock: 15,
  })
  const pid = p.data.product.id
  const prov = await admin.post('/api/suppliers', { name: `Dist ${t}` })
  await admin.post('/api/users', {
    name: 'Cajero Luis',
    email: `luis_${t}@test.com`,
    password: 'VentoryQA2026',
    role: 'CASHIER',
    branchId,
  })

  const luis = await loginOnly(browser, `luis_${t}@test.com`, 'VentoryQA2026')
  const page = luis.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(BASE + '/app')
  await page.waitForTimeout(3000)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }

  // ── LA PANTALLA SE PONE AL DÍA SOLA ──
  await page.locator('nav button', { hasText: 'Productos' }).first().click()
  await page.waitForTimeout(1500)
  await page.fill('input[placeholder*="Buscar"]', `Cafe ${t}`)
  await page.waitForTimeout(700)
  check('refresco', 'Luis ve el stock inicial (15)', (await page.textContent('body')).includes('15'))

  const compra = await admin.post('/api/purchases', {
    supplierId: prov.data.supplier.id,
    branchId,
    method: 'TRANSFER',
    items: [{ productId: pid, quantity: 50, unitCost: 8000 }],
  })
  check('refresco', 'el dueño registra +50 desde otra sesión', compra.status === 201)

  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(2500)
  check(
    'refresco',
    'la pantalla de Luis muestra 65 SIN recargar la página',
    (await page.textContent('body')).includes('65'),
    'sigue mostrando el stock viejo',
  )

  // ── EL REFRESCO NO DAÑA EL TRABAJO EN CURSO ──
  const caja = await luis.post('/api/cash-registers/open', { branchId, openingBalance: 20000 })
  check('refresco', 'Luis abre su caja', caja.status === 201)
  await page.locator('nav button', { hasText: 'Punto de Venta' }).first().click()
  await page.waitForTimeout(2000)
  await page.fill('input[placeholder*="Buscar"]', `Cafe ${t}`)
  await page.waitForTimeout(700)
  await page.locator('main button', { hasText: `Cafe ${t}` }).first().click()
  await page.waitForTimeout(400)
  await page.locator('main button', { hasText: `Cafe ${t}` }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[placeholder="Opcional"]', 'Doña Marta')

  await admin.post('/api/purchases', {
    supplierId: prov.data.supplier.id,
    branchId,
    method: 'TRANSFER',
    items: [{ productId: pid, quantity: 10, unitCost: 8000 }],
  })
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(2500)

  check(
    'refresco',
    'el carrito a medio armar sobrevive al refresco (2 unidades)',
    /Vaciar · 2/.test(await page.textContent('body')),
  )
  check(
    'refresco',
    'lo digitado (cliente) sobrevive al refresco',
    (await page.locator('input[placeholder="Opcional"]').inputValue()) === 'Doña Marta',
  )
  const stockInterno = await page.evaluate(async () => {
    const r = await (await fetch('/api/products')).json()
    return r.products[0]?.stock
  })
  check('refresco', 'y aún así el stock interno ya está al día (75)', stockInterno === 75, `${stockInterno}`)

  // ── LA VENTA USA EL STOCK REAL, NO EL DE LA PANTALLA ──
  const sid = caja.data?.session?.id ?? (await luis.get('/api/cash-registers/current')).data?.session?.id
  const venta = await luis.post('/api/sales', {
    cashSessionId: sid,
    items: [{ productId: pid, quantity: 2, unitPrice: 12000 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 24000, card: 0, transfer: 0 },
  })
  check('refresco', 'la venta pasa y descuenta sobre el stock real', venta.status === 201)
  const final = await admin.get('/api/products')
  check(
    'refresco',
    'stock final exacto: 15 + 50 + 10 − 2 = 73',
    final.data.products.find((x) => x.id === pid)?.stock === 73,
    `${final.data.products.find((x) => x.id === pid)?.stock}`,
  )

  check('refresco', 'ningún error de JavaScript', errores.length === 0, errores.join(' | '))

  await luis.ctx.close()
  await admin.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
