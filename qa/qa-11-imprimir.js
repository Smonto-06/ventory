// PRUEBA 11: ventana de impresión propia de Ventory
//
// Todos los recibos deben imprimir a través del selector del sistema (térmica
// directa o impresora del computador), nunca saltando al diálogo del navegador
// sin preguntar, y nunca imprimiendo solos.

const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Imprimir ${t}`,
    name: 'Impresor',
    email: `qa_imp_${t}@test.com`,
    password: 'VentoryQA2026',
  })
  const branchId = (await S.get('/api/branches')).data.branches[0].id
  const p = await S.post('/api/products', {
    name: `Vela ${t}`,
    price: 5000,
    cost: 2000,
    branchId,
    initialStock: 50,
  })
  const prov = await S.post('/api/suppliers', { name: `Cera ${t}` })
  const caja = await S.post('/api/cash-registers/open', { branchId, openingBalance: 50000 })
  const sid = caja.data?.session?.id ?? caja.data?.cashSession?.id

  const page = S.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))

  // espiar window.print: no debe dispararse sin elegirlo en el selector
  await page.addInitScript(() => {
    window.__impresionesSistema = 0
    const original = window.print.bind(window)
    window.print = () => {
      window.__impresionesSistema++
    }
  })

  await page.goto(BASE + '/app')
  await page.waitForTimeout(2500)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }

  const contarImpresiones = () => page.evaluate(() => window.__impresionesSistema)

  const probarSelector = async (nombre, botonTexto, sinTiquete = false) => {
    const btn = page.locator(`button:has-text("${botonTexto}")`).first()
    const hay = (await btn.count()) > 0
    check('imprimir', `${nombre}: hay botón "${botonTexto}"`, hay)
    if (!hay) return
    await btn.click()
    await page.waitForTimeout(600)
    const cuerpo = await page.textContent('body')
    check('imprimir', `${nombre}: se abre el selector de Ventory`, cuerpo.includes('¿Por dónde sale?'))
    check('imprimir', `${nombre}: ofrece la térmica`, cuerpo.includes('Impresora térmica'))
    check('imprimir', `${nombre}: ofrece la impresora del computador`, cuerpo.includes('Impresora del computador'))
    // sin térmica conectada, la opción debe explicar por qué no está activa
    check(
      'imprimir',
      sinTiquete
        ? `${nombre}: explica que este documento no va a la térmica`
        : `${nombre}: explica dónde conectar la térmica`,
      sinTiquete
        ? cuerpo.includes('no tiene formato de tiquete')
        : cuerpo.includes('Ajustes → Impresora de tickets'),
    )
    // elegir el sistema: recién ahí sale el diálogo (espiado)
    const antes = await contarImpresiones()
    await page.locator('button:has-text("Impresora del computador")').first().click()
    await page.waitForTimeout(200)
    await page.locator('button:has-text("Imprimir")').last().click()
    await page.waitForTimeout(700)
    const despues = await contarImpresiones()
    check('imprimir', `${nombre}: el diálogo del sistema solo sale al elegirlo`, despues === antes + 1, `${antes} → ${despues}`)
  }

  // ── TICKET DE VENTA ──
  await page.locator('nav button', { hasText: 'Punto de Venta' }).first().click()
  await page.waitForTimeout(2000)
  await page.fill('input[placeholder*="Buscar"]', `Vela ${t}`)
  await page.waitForTimeout(700)
  await page.locator('main button', { hasText: `Vela ${t}` }).first().click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: 'Cobrar' }).first().click()
  await page.waitForTimeout(1200)
  // pagar exacto en efectivo y finalizar
  await page.locator('button', { hasText: 'Exacto' }).first().click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: 'Finalizar venta' }).first().click()
  await page.waitForTimeout(2200)
  const cuerpoRecibo = await page.textContent('body')
  const impresionesTrasVenta = await contarImpresiones()
  check(
    'imprimir',
    'después de cobrar NO se imprime nada solo',
    impresionesTrasVenta === 0,
    `${impresionesTrasVenta} impresiones espontáneas`,
  )
  // el recibo carta también tiene el selector propio
  await probarSelector('factura de venta', 'Imprimir factura', true)
  // pasar al ticket 80 mm y probar el suyo
  await page.locator('button:has-text("Ticket 80mm")').first().click()
  await page.waitForTimeout(1200)
  await probarSelector('ticket de venta', 'Imprimir ticket')

  // ── COTIZACIÓN ──
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2500)
  await page.locator('nav button', { hasText: 'Punto de Venta' }).first().click()
  await page.waitForTimeout(1500)
  await page.fill('input[placeholder*="Buscar"]', `Vela ${t}`)
  await page.waitForTimeout(700)
  await page.locator('main button', { hasText: `Vela ${t}` }).first().click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: 'Cotizar (no descuenta inventario)' }).first().click()
  await page.waitForTimeout(700)
  await page.fill('input[placeholder*="Nombre de quien"]', 'Cliente Impresión')
  await page.locator('button', { hasText: 'Emitir cotización' }).first().click()
  await page.waitForTimeout(2200)
  await probarSelector('cotización', 'Imprimir')

  // ── RECIBO DE COMPRA ── (por API y navegando a la pantalla)
  const compra = await S.post('/api/purchases', {
    supplierId: prov.data.supplier.id,
    branchId,
    method: 'TRANSFER',
    items: [{ productId: p.data.product.id, quantity: 5, unitCost: 2000 }],
  })
  check('imprimir', 'la compra para el recibo se registra', compra.status === 201)

  check('imprimir', 'ningún error de JavaScript', errores.length === 0, errores.join(' | ').slice(0, 200))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
