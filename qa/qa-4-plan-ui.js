// PRUEBA 4: plan comercial, super admin, catálogos y recorrido completo de la interfaz
const { check, summary, newBrowser, registerAndLogin, loginOnly, BASE } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Plan ${t}`, name: 'Pablo QA', email: `plan-${t}@test.com`, password: 'ClaveSegura99',
  })
  const branchId = (await S.get('/api/branches')).data.branches[0].id

  // ── CATÁLOGOS ──
  const cat = await S.post('/api/categories', { name: `Cat ${t}` })
  check('catálogos', 'crear categoría', cat.status < 300, `status ${cat.status}`)
  const catDup = await S.post('/api/categories', { name: `Cat ${t}` })
  check('catálogos', 'rechaza categoría duplicada', catDup.status >= 400, `status ${catDup.status}`)

  const prov = await S.post('/api/suppliers', { name: `Proveedor ${t}`, phone: '3001234567' })
  check('catálogos', 'crear proveedor', prov.status < 300, `status ${prov.status}`)

  const cli = await S.post('/api/customers', { name: `Cliente ${t}`, phone: '3007654321' })
  check('catálogos', 'crear cliente', cli.status < 300, `status ${cli.status}`)
  const cliSinNombre = await S.post('/api/customers', { name: '' })
  check('catálogos', 'rechaza cliente sin nombre', cliSinNombre.status >= 400, `status ${cliSinNombre.status}`)

  // ── AJUSTES DEL NEGOCIO ──
  const cfg = await S.put('/api/settings', { name: `QA Plan ${t}`, taxId: '900.111.222-3', phone: '3111111111', address: 'Calle 1 #2-3', receiptFooter: '¡Gracias!', ivaPct: 19 })
  check('ajustes', 'guardar datos de facturación e IVA', cfg.status === 200, `status ${cfg.status}`)
  const cfgLeido = await S.get('/api/settings')
  check('ajustes', 'los datos guardados se leen de vuelta', cfgLeido.data.settings?.taxId === '900.111.222-3' && cfgLeido.data.settings?.ivaPct === 19, JSON.stringify(cfgLeido.data.settings?.taxId))

  const ivaInvalido = await S.put('/api/settings', { ivaPct: 90 })
  check('ajustes', 'rechaza IVA fuera de rango', ivaInvalido.status === 400, `status ${ivaInvalido.status}`)

  // venta con IVA para verificar el desglose incluido
  await S.post('/api/cash-registers/open', { branchId, openingBalance: 50000 })
  const sid = (await S.get('/api/cash-registers/current')).data.session.id
  const p = (await S.post('/api/products', { name: `ProdIva ${t}`, price: 11900, branchId, initialStock: 10 })).data.product
  const vIva = await S.post('/api/sales', { cashSessionId: sid, items: [{ productId: p.id, quantity: 1, unitPrice: 11900 }], paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 11900, card: 0, transfer: 0 } })
  const ivaCalc = vIva.data.sale?.taxAmount
  check('ajustes', 'IVA incluido se calcula bien (11.900 al 19% → 1.900)', Number(ivaCalc) === 1900, `iva ${ivaCalc}`)

  // ── PLAN COMERCIAL: negocio suspendido no puede vender ──
  // Un segundo negocio desde la misma conexión, para probar la detección de
  // prueba gratis repetida (basta el registro; no hace falta verificarlo)
  await fetch(BASE + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Gemelo', email: `gemelo-${t}@test.com`, password: 'ClaveSegura99', businessName: `QA Gemelo ${t}` }),
  })

  const admin = await loginOnly(browser, 'mar_u_79@hotmail.com', 'VentoryBB2026')
  const negocios = await admin.get('/api/admin/businesses')
  const esSuper = negocios.status === 200
  check('super admin', 'el super admin puede listar todos los negocios', esSuper, `status ${negocios.status}`)

  if (esSuper) {
    const mio = negocios.data.businesses.find(b => b.name === `QA Plan ${t}`)
    check('super admin', 've el negocio recién creado en la lista', !!mio, 'no aparece')

    // Detección de prueba repetida: el registro guarda la IP y la lista marca
    // los negocios nacidos de la misma conexión (en QA todos comparten IP)
    if (mio) {
      check('super admin', 'el registro guarda desde dónde se creó el negocio', !!mio.registro?.ip, JSON.stringify(mio.registro))
      check(
        'super admin',
        'y detecta otros negocios de la misma conexión (posible prueba repetida)',
        mio.registro?.repetidos >= 1,
        `repetidos: ${mio.registro?.repetidos}`,
      )
    }

    if (mio) {
      // suspender
      await admin.post(`/api/admin/businesses/${mio.id}`, { action: 'suspend' })
      const ventaSuspendido = await S.post('/api/sales', { cashSessionId: sid, items: [{ productId: p.id, quantity: 1, unitPrice: 11900 }], paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 11900, card: 0, transfer: 0 } })
      check('plan', 'un negocio SUSPENDIDO no puede vender', ventaSuspendido.status === 402, `status ${ventaSuspendido.status}`)
      const compraSuspendido = await S.post('/api/purchases', { branchId, supplierName: 'X', method: 'TRANSFER', items: [{ productId: p.id, quantity: 1, unitCost: 100 }] })
      check('plan', 'un negocio SUSPENDIDO no puede registrar compras', compraSuspendido.status === 402, `status ${compraSuspendido.status}`)
      const leerSuspendido = await S.get('/api/products')
      check('plan', 'un negocio suspendido SÍ puede consultar sus datos (solo lectura)', leerSuspendido.status === 200, `status ${leerSuspendido.status}`)

      // activar
      await admin.post(`/api/admin/businesses/${mio.id}`, { action: 'activate' })
      const ventaActivo = await S.post('/api/sales', { cashSessionId: sid, items: [{ productId: p.id, quantity: 1, unitPrice: 11900 }], paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 11900, card: 0, transfer: 0 } })
      check('plan', 'al activar el plan vuelve a vender', ventaActivo.status === 201, `status ${ventaActivo.status}`)

      // eliminar con confirmación equivocada
      const borrarMal = await admin.del(`/api/admin/businesses/${mio.id}`, { confirm: 'nombre equivocado' })
      check('super admin', 'no elimina un negocio si el nombre no coincide', borrarMal.status === 400, `status ${borrarMal.status}`)

      // notas privadas: se pueden guardar sin tocar el estado del plan
      const notaGuardada = await admin.post(`/api/admin/businesses/${mio.id}`, { notes: 'Nota de prueba QA' })
      check('super admin', 'guarda una nota sin cambiar el plan', notaGuardada.status === 200, `status ${notaGuardada.status}`)
      const trasNota = (await admin.get('/api/admin/businesses')).data.businesses.find(b => b.id === mio.id)
      check('super admin', 'la nota queda guardada y el plan sigue activo', trasNota?.adminNotes === 'Nota de prueba QA' && trasNota?.plan.status === 'ACTIVE', JSON.stringify(trasNota?.adminNotes))

      // registro de actividad: las acciones de plataforma quedan con rastro
      const actividad = await admin.get('/api/admin/activity')
      check('super admin', 'el registro de actividad responde', actividad.status === 200, `status ${actividad.status}`)
      const huboNota = (actividad.data.entries ?? []).some(e => e.action === 'PLATFORM_NOTES' && e.businessId === mio.id)
      check('super admin', 'la nota queda registrada en la actividad reciente', huboNota, JSON.stringify(actividad.data.entries?.[0]))
    }

    // solo el super admin puede ver el registro de actividad
    const actividadCajero = await S.get('/api/admin/activity')
    check('super admin', 'un negocio normal NO puede ver la actividad de plataforma', actividadCajero.status === 403, `status ${actividadCajero.status}`)

    // el super admin no puede eliminar su propio negocio
    const propio = negocios.data.businesses.find(b => b.owner?.email === 'mar_u_79@hotmail.com')
    if (propio) {
      const borrarPropio = await admin.del(`/api/admin/businesses/${propio.id}`, { confirm: propio.name })
      check('super admin', 'no puede eliminar su propio negocio', borrarPropio.status === 400, `status ${borrarPropio.status}`)
    }
  }
  await admin.ctx.close()

  // ── RECORRIDO DE LA INTERFAZ ──
  const page = S.page
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2500)
  const omitir = await page.locator('text=Omitir por ahora').count()
  if (omitir) { await page.locator('text=Omitir por ahora').click(); await page.waitForTimeout(600) }

  const errores = []
  page.on('pageerror', e => errores.push(e.message))

  const pantallas = ['Panel Principal', 'Productos', 'Compras', 'Proveedores', 'Ventas', 'Movimientos', 'Reportes', 'Clientes', 'Punto de Venta']
  for (const nombre of pantallas) {
    try {
      // el Punto de Venta ocupa toda la pantalla: si estamos ahí, volver al panel
      const inicio = await page.locator('button:has-text("Inicio")').count()
      if (inicio) { await page.locator('button:has-text("Inicio")').first().click(); await page.waitForTimeout(700) }
      await page.locator(`button:has-text("${nombre}")`).first().click({ timeout: 8000 })
      await page.waitForTimeout(900)
      const vacio = await page.locator('body').innerText()
      check('interfaz', `la pantalla "${nombre}" carga sin errores`, vacio.length > 100 && !vacio.includes('Application error'), vacio.slice(0, 60))
    } catch (e) {
      check('interfaz', `la pantalla "${nombre}" carga sin errores`, false, e.message.slice(0, 50))
    }
  }

  // ── "VER TODOS" DEL STOCK BAJO LLEVA A PRODUCTOS YA FILTRADO ──
  const volverPos = await page.locator('button:has-text("Inicio")').count()
  if (volverPos) { await page.locator('button:has-text("Inicio")').first().click(); await page.waitForTimeout(700) }
  await S.post('/api/products', { name: `QA Bajo ${t}`, price: 1000, branchId, initialStock: 0 })
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2200)
  try {
    await page
      .locator('div')
      .filter({ hasText: 'Stock bajo' })
      .filter({ has: page.locator('button:has-text("Ver todos")') })
      .last()
      .locator('button:has-text("Ver todos")')
      .click({ timeout: 8000 })
    await page.waitForTimeout(900)
    const textoFiltrado = await page.locator('body').innerText()
    check(
      'interfaz',
      '"Ver todos" del stock bajo lleva a Productos ya filtrado',
      textoFiltrado.includes(`QA Bajo ${t}`) && textoFiltrado.includes('Solo stock bajo'),
      'no filtró',
    )
    // quitar el filtro deja ver los demás productos otra vez
    await page.locator('button:has-text("Solo stock bajo")').first().click()
    await page.waitForTimeout(500)
    check('interfaz', 'quitar el filtro vuelve a mostrar todos los productos', (await page.locator('body').innerText()).includes(`ProdIva ${t}`), 'no aparece')
  } catch (e) {
    check('interfaz', '"Ver todos" del stock bajo lleva a Productos ya filtrado', false, e.message.slice(0, 60))
  }

  // ── EDITAR EL PRECIO DE UN ARTÍCULO DESDE EL CARRITO ──
  const prodPrecio = (await S.post('/api/products', { name: `QA Precio ${t}`, price: 4000, branchId, initialStock: 10 })).data.product
  await page.locator('nav button', { hasText: 'Punto de Venta' }).first().click()
  await page.waitForTimeout(900)
  await page.locator('main button', { hasText: `QA Precio ${t}` }).first().click()
  await page.waitForTimeout(700)
  try {
    await page.locator('button[title="Cambiar el precio de este artículo"]').click({ timeout: 8000 })
    await page.waitForTimeout(500)
    const modal = page.locator('div', { hasText: 'Precio del artículo' }).last()
    await modal.locator('input').fill('4700')
    await modal.locator('button:has-text("Aplicar")').click()
    await page.waitForTimeout(700)
    const conNuevoPrecio = await page.locator('body').innerText()
    check('interfaz', 'editar el precio de un artículo actualiza el total a cobrar', conNuevoPrecio.includes('4.700'), 'no se ve el nuevo precio')
  } catch (e) {
    check('interfaz', 'editar el precio de un artículo actualiza el total a cobrar', false, e.message.slice(0, 60))
  }

  // ── ELEGIR LA CANTIDAD DE UN ARTÍCULO CON EL TECLADO NUMÉRICO ──
  try {
    await page.locator('span[title="Toca para digitar la cantidad"]').click({ timeout: 8000 })
    await page.waitForTimeout(500)
    const modalCant = page.locator('div', { hasText: 'Cantidad' }).last()
    await modalCant.locator('button', { hasText: /^3$/ }).click()
    await modalCant.locator('button', { hasText: /^0$/ }).click()
    await modalCant.locator('button:has-text("Aplicar")').click()
    await page.waitForTimeout(700)
    const conNuevaCantidad = await page.locator('body').innerText()
    check('interfaz', 'elegir la cantidad con el teclado numérico actualiza el carrito', conNuevaCantidad.includes('30'), 'no quedó en 30')
  } catch (e) {
    check('interfaz', 'elegir la cantidad con el teclado numérico actualiza el carrito', false, e.message.slice(0, 60))
  }

  // modales principales
  const volver = await page.locator('button:has-text("Inicio")').count()
  if (volver) { await page.locator('button:has-text("Inicio")').first().click(); await page.waitForTimeout(800) }
  for (const [boton, titulo] of [['Ajustes', 'Ajustes'], ['Cerrar caja', 'Cerrar caja']]) {
    try {
      await page.locator(`button:has-text("${boton}")`).first().click({ timeout: 8000 })
      await page.waitForTimeout(800)
      const visible = await page.locator(`text=${titulo}`).count()
      check('interfaz', `"${boton}" abre correctamente`, visible > 0, 'no se ve el título')
      await page.keyboard.press('Escape')
      const cerrar = await page.locator('button:has-text("✕")').count()
      if (cerrar) await page.locator('button:has-text("✕")').first().click().catch(() => {})
      await page.waitForTimeout(400)
    } catch (e) {
      check('interfaz', `"${boton}" abre correctamente`, false, e.message.slice(0, 50))
    }
  }

  check('interfaz', 'ningún error de JavaScript durante el recorrido', errores.length === 0, errores.slice(0, 2).join(' | '))

  // ── PANTALLA COMPLETA (terminales táctiles sin teclado) ──
  // el recorrido termina en "Cerrar caja", que es a pantalla completa y no
  // tiene menú lateral: hay que volver al panel antes de seguir
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2500)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }
  // el menú lateral se revisa desde el panel: el punto de venta es a
  // pantalla completa y no lo muestra
  check('pantalla', 'el menú lateral ofrece pantalla completa', (await page.locator('nav button', { hasText: 'Pantalla completa' }).count()) > 0)
  await page.locator('nav button', { hasText: 'Punto de Venta' }).first().click()
  await page.waitForTimeout(1500)
  const btnFull = page.locator('button[aria-label="Pantalla completa"]')
  check('pantalla', 'el punto de venta ofrece el botón de pantalla completa', (await btnFull.count()) > 0)
  if (await btnFull.count()) {
    await btnFull.first().click()
    await page.waitForTimeout(700)
    check('pantalla', 'entra en pantalla completa', await page.evaluate(() => !!document.fullscreenElement))
    const btnSalir = page.locator('button[aria-label="Salir de pantalla completa"]')
    check('pantalla', 'el botón cambia a "salir"', (await btnSalir.count()) > 0)
    if (await btnSalir.count()) {
      await btnSalir.first().click()
      await page.waitForTimeout(700)
      check('pantalla', 'sale de pantalla completa', !(await page.evaluate(() => !!document.fullscreenElement)))
    }
  }

  await browser.close()
  process.exit(summary() > 0 ? 1 : 0)
})().catch(e => { console.error('ERROR EN LA PRUEBA:', e.message); process.exit(2) })
