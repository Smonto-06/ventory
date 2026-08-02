// PRUEBA 7: variantes de producto (talla, color) de extremo a extremo
const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Variantes ${t}`,
    name: 'Tienda de Ropa',
    email: `qa_var_${t}@test.com`,
    password: 'VentoryQA2026',
  })

  const suc = await S.get('/api/branches')
  const branchId = suc.data.branches[0].id

  // ── CREACIÓN ──
  const creado = await S.post('/api/products', {
    name: `Camiseta ${t}`,
    price: 45000,
    cost: 20000,
    branchId,
    variantOptions: [
      { nombre: 'Talla', valores: ['S', 'M', 'L'] },
      { nombre: 'Color', valores: ['Azul', 'Negro'] },
    ],
    variantes: [
      { label: 'S / Azul', sku: `V${t}SA`, initialStock: 3 },
      { label: 'S / Negro', sku: `V${t}SN`, initialStock: 2 },
      { label: 'M / Azul', sku: `V${t}MA`, initialStock: 5, price: 47000 },
      { label: 'M / Negro', sku: `V${t}MN`, initialStock: 0 },
      { label: 'L / Azul', sku: `V${t}LA`, initialStock: 4 },
      { label: 'L / Negro', sku: `V${t}LN`, initialStock: 1, barcode: `770${t}` },
    ],
  })
  check('variantes', 'se crea un producto con 6 variantes', creado.status === 201, `status ${creado.status}`)
  const padreId = creado.data?.product?.id

  const lista = await S.get('/api/products')
  const todos = lista.data.products
  const padre = todos.find((p) => p.id === padreId)
  const hijas = todos.filter((p) => p.parentId === padreId)

  check('variantes', 'el producto queda marcado como agrupador', padre?.hasVariants === true)
  check('variantes', 'se crearon las 6 variantes', hijas.length === 6, `${hijas.length}`)
  check('variantes', 'el agrupador no tiene stock propio', padre?.stock === 0, `${padre?.stock}`)
  check(
    'variantes',
    'el nombre de cada variante incluye su combinación',
    hijas.every((h) => h.name === `Camiseta ${t} · ${h.variantLabel}`),
  )
  check(
    'variantes',
    'cada variante tiene su propio stock',
    hijas.reduce((a, h) => a + h.stock, 0) === 15,
    `total ${hijas.reduce((a, h) => a + h.stock, 0)}`,
  )
  const mAzul = hijas.find((h) => h.variantLabel === 'M / Azul')
  check('variantes', 'una variante puede tener precio distinto', mAzul?.price === 47000, `${mAzul?.price}`)
  const sAzul = hijas.find((h) => h.variantLabel === 'S / Azul')
  check('variantes', 'las demás heredan el precio general', sAzul?.price === 45000, `${sAzul?.price}`)
  check('variantes', 'el agrupador guarda las opciones', Array.isArray(padre?.variantOptions) && padre.variantOptions.length === 2)

  // ── EL AGRUPADOR NO SE VENDE ──
  const busq = await S.get(`/api/products/search?q=Camiseta ${t}`)
  const enBusqueda = busq.data.products || []
  check(
    'variantes',
    'el agrupador NO aparece en la búsqueda de cobro',
    !enBusqueda.some((p) => p.id === padreId),
    'aparece y no debería',
  )
  check('variantes', 'las variantes sí aparecen en la búsqueda', enBusqueda.length >= 6, `${enBusqueda.length}`)

  const porCodigo = await S.get(`/api/products/search?barcode=770${t}`)
  check(
    'variantes',
    'el lector de código encuentra la variante exacta',
    (porCodigo.data.products || [])[0]?.id === hijas.find((h) => h.variantLabel === 'L / Negro')?.id,
  )

  // ── VENDER UNA VARIANTE ──
  const caja = await S.post('/api/cash-registers/open', { branchId, openingBalance: 50000 })
  const sid = caja.data?.session?.id ?? caja.data?.cashSession?.id
  const venta = await S.post('/api/sales', {
    cashSessionId: sid,
    items: [{ productId: mAzul.id, quantity: 2, unitPrice: 47000 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 100000, card: 0, transfer: 0 },
  })
  check('variantes', 'se puede vender una variante', venta.status === 201, `status ${venta.status}`)

  const tras = await S.get('/api/products')
  const mAzulTras = tras.data.products.find((p) => p.id === mAzul.id)
  const padreTras = tras.data.products.find((p) => p.id === padreId)
  check('variantes', 'la venta descuenta el stock de esa variante', mAzulTras?.stock === 3, `${mAzulTras?.stock}`)
  check(
    'variantes',
    'no toca el stock de las otras variantes',
    tras.data.products.find((p) => p.variantLabel === 'S / Azul' && p.parentId === padreId)?.stock === 3,
  )
  check('variantes', 'el agrupador sigue sin stock propio', padreTras?.stock === 0, `${padreTras?.stock}`)

  // ── AGREGAR VARIANTES DESPUÉS ──
  const mas = await S.post(`/api/products/${padreId}/variants`, {
    branchId,
    variantes: [{ label: 'XL / Azul', sku: `V${t}XA`, initialStock: 6 }],
  })
  check('variantes', 'se pueden agregar variantes después', mas.status === 201, `status ${mas.status}`)

  const repetida = await S.post(`/api/products/${padreId}/variants`, {
    branchId,
    variantes: [{ label: 'S / Azul', initialStock: 1 }],
  })
  check('variantes', 'rechaza una variante repetida', repetida.status === 400, `status ${repetida.status}`)

  // ── RENOMBRAR EL AGRUPADOR ARRASTRA A SUS VARIANTES ──
  await S.patch(`/api/products/${padreId}`, { name: `Camiseta Premium ${t}` })
  const renombrado = await S.get('/api/products')
  const hijasR = renombrado.data.products.filter((p) => p.parentId === padreId)
  check(
    'variantes',
    'al renombrar el producto se renombran sus variantes',
    hijasR.every((h) => h.name.startsWith(`Camiseta Premium ${t} ·`)),
    hijasR[0]?.name,
  )

  // ── CONVERTIR UN PRODUCTO SUELTO EN UNO CON VARIANTES ──
  const suelto = await S.post('/api/products', {
    name: `Gorra ${t}`,
    price: 25000,
    cost: 10000,
    branchId,
    initialStock: 7,
  })
  const gorraId = suelto.data.product.id
  const conv = await S.post(`/api/products/${gorraId}/variants`, {
    branchId,
    variantOptions: [{ nombre: 'Color', valores: ['Roja', 'Verde'] }],
    variantes: [
      { label: 'Roja', initialStock: 0 },
      { label: 'Verde', initialStock: 4 },
    ],
  })
  check('variantes', 'un producto suelto se convierte en agrupador', conv.status === 201 && conv.data.convertido === true)

  const trasConv = await S.get('/api/products')
  const gorra = trasConv.data.products.find((p) => p.id === gorraId)
  const gorras = trasConv.data.products.filter((p) => p.parentId === gorraId)
  check('variantes', 'el producto convertido queda como agrupador sin stock', gorra?.hasVariants === true && gorra?.stock === 0)
  const roja = gorras.find((g) => g.variantLabel === 'Roja')
  check(
    'variantes',
    'el stock que tenía se traslada a la primera variante (no se pierde ni se duplica)',
    roja?.stock === 7 && gorras.reduce((a, g) => a + g.stock, 0) === 11,
    `roja ${roja?.stock}, total ${gorras.reduce((a, g) => a + g.stock, 0)}`,
  )

  // ── ARCHIVAR EL AGRUPADOR ARRASTRA A SUS VARIANTES ──
  await S.del(`/api/products/${gorraId}`)
  const trasArchivar = await S.get('/api/products?status=all')
  const gorrasArch = trasArchivar.data.products.filter((p) => p.parentId === gorraId)
  check(
    'variantes',
    'al archivar el producto se archivan sus variantes',
    gorrasArch.length > 0 && gorrasArch.every((g) => g.status === 'ARCHIVED'),
    gorrasArch.map((g) => g.status).join(','),
  )

  // ── INTERFAZ ──
  const page = S.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2500)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }

  await page.locator('nav button', { hasText: 'Productos' }).first().click()
  await page.waitForTimeout(1800)
  const cuerpo = await page.textContent('body')
  check('variantes/ui', 'la lista muestra el producto agrupado', cuerpo.includes(`Camiseta Premium ${t}`))
  check('variantes/ui', 'indica cuántas variantes tiene', /\d+ variantes/.test(cuerpo))
  check(
    'variantes/ui',
    'las variantes no se listan sueltas',
    !cuerpo.includes(`Camiseta Premium ${t} · M / Azul`),
    'aparece la variante como fila propia',
  )

  const chip = page.locator('button', { hasText: /^\d+ variantes/ }).first()
  await chip.click()
  await page.waitForTimeout(700)
  const desplegado = await page.textContent('body')
  check('variantes/ui', 'al desplegarlo se ven las combinaciones', desplegado.includes('M / Azul') && desplegado.includes('L / Negro'))

  // punto de venta: una tarjeta, selector al tocarla
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2000)
  await page.locator('nav button', { hasText: 'Punto de Venta' }).first().click()
  await page.waitForTimeout(2000)
  await page.fill('input[placeholder*="Buscar"]', `Camiseta Premium ${t}`)
  await page.waitForTimeout(900)
  const tarjetas = await page.locator('main button', { hasText: `Camiseta Premium ${t}` }).count()
  check('variantes/ui', 'el punto de venta muestra una sola tarjeta del producto', tarjetas === 1, `${tarjetas} tarjetas`)
  check('variantes/ui', 'la tarjeta avisa que hay que elegir', (await page.textContent('main')).includes('ELEGIR'))

  await page.locator('main button', { hasText: `Camiseta Premium ${t}` }).first().click()
  await page.waitForTimeout(900)
  const selector = await page.textContent('body')
  check('variantes/ui', 'se abre el selector de variante', selector.includes('Elige la variante'))
  check('variantes/ui', 'el selector muestra las existencias', /disponibles/.test(selector))
  check('variantes/ui', 'marca como agotada la que no tiene stock', selector.includes('Agotada'))

  await page.locator('button', { hasText: 'M / Azul' }).first().click()
  await page.waitForTimeout(900)
  const carrito = await page.textContent('body')
  check('variantes/ui', 'al elegir la variante entra al carrito', carrito.includes('M / Azul'))
  check('variantes/ui', 'ningún error de JavaScript', errores.length === 0, errores.join(' | '))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
