// PRUEBA 5: móvil + modo offline real (cortar la red, vender, reconectar y sincronizar)
const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)

  // ── MÓVIL: la app debe ser usable en pantalla de celular ──
  const S = await registerAndLogin(browser, {
    businessName: `QA Movil ${t}`, name: 'Mario QA', email: `mov-${t}@test.com`, password: 'ClaveSegura99',
  })
  const branchId = (await S.get('/api/branches')).data.branches[0].id
  const prod = (await S.post('/api/products', { name: `Movil ${t}`, price: 5000, branchId, initialStock: 50 })).data.product
  await S.post('/api/cash-registers/open', { branchId, openingBalance: 50000 })

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mp = await mobile.newPage()
  await mp.addInitScript(() => localStorage.setItem('ventory-novedades', '0'))
  await mp.goto(BASE + '/login')
  await mp.fill('input[type=email]', `mov-${t}@test.com`)
  await mp.fill('input[placeholder="Contraseña"]', 'ClaveSegura99')
  await mp.click('button[type=submit]')
  await mp.waitForURL('**/app', { timeout: 20000 })
  await mp.waitForTimeout(2000)
  const om = await mp.locator('text=Omitir por ahora').count()
  if (om) { await mp.locator('text=Omitir por ahora').click(); await mp.waitForTimeout(600) }

  // sin scroll horizontal (error clásico en móvil)
  const scrollH = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  check('móvil', 'el panel no tiene scroll horizontal', !scrollH, 'la página se desborda a lo ancho')

  // En celular el menú es horizontal y no existe el pie del escritorio: el
  // cerrar sesión debe estar al final del menú (deslizando)
  const salirMovil = await mp.locator('aside button:has-text("Cerrar sesión")').count()
  check('móvil', 'el menú del celular tiene "Cerrar sesión"', salirMovil > 0, 'no aparece en el menú')

  await mp.locator('button:has-text("Punto de Venta")').first().click()
  await mp.waitForTimeout(1200)
  const scrollPos = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  check('móvil', 'el punto de venta no tiene scroll horizontal', !scrollPos, 'la página se desborda a lo ancho')

  const barraCobrar = await mp.locator('button:has-text("Cobrar")').count()
  check('móvil', 'la barra de cobro es visible en celular', barraCobrar > 0, 'no se ve el botón Cobrar')

  // vender desde el celular
  await mp.fill('input[placeholder*="Buscar"]', 'Movil')
  await mp.waitForTimeout(700)
  await mp.locator(`button:has-text("Movil ${t}")`).first().click()
  await mp.waitForTimeout(500)
  await mp.locator('button:has-text("Cobrar")').first().click()
  await mp.waitForTimeout(900)
  const enCobro = await mp.locator('text=/Efectivo/').count()
  check('móvil', 'la pantalla de cobro abre en celular', enCobro > 0, 'no llegó a cobro')
  if (enCobro) {
    await mp.locator('button:has-text("Efectivo")').first().click()
    await mp.waitForTimeout(500)
    await mp.locator('button:has-text("Exacto")').click()
    await mp.locator('button:has-text("Finalizar venta")').click()
    await mp.waitForTimeout(2000)
    const recibo = await mp.locator('text=Venta registrada').count()
    check('móvil', 'se completa una venta desde el celular', recibo > 0, 'no apareció el comprobante')
  }

  // ── OFFLINE REAL ──
  const stockAntes = (await S.get(`/api/products/${prod.id}`)).data.product.stock
  await mp.locator('button:has-text("Nueva venta")').first().click().catch(() => {})
  await mp.waitForTimeout(1200)

  // cortar la red del navegador
  await mobile.setOffline(true)
  await mp.waitForTimeout(1500)
  const aviso = await mp.locator('text=/Sin conexión/i').count()
  check('offline', 'aparece el aviso "Sin conexión"', aviso > 0, 'no se ve el aviso')

  // vender dos veces sin internet
  let vendidasOffline = 0
  for (let i = 0; i < 2; i++) {
    try {
      await mp.fill('input[placeholder*="Buscar"]', 'Movil')
      await mp.waitForTimeout(500)
      await mp.locator(`button:has-text("Movil ${t}")`).first().click()
      await mp.waitForTimeout(400)
      await mp.locator('button:has-text("Cobrar")').first().click()
      await mp.waitForTimeout(700)
      await mp.locator('button:has-text("Efectivo")').first().click()
      await mp.waitForTimeout(400)
      await mp.locator('button:has-text("Exacto")').click()
      await mp.locator('button:has-text("Finalizar venta")').click()
      await mp.waitForTimeout(1500)
      vendidasOffline++
      const nueva = await mp.locator('button:has-text("Nueva venta")').count()
      if (nueva) { await mp.locator('button:has-text("Nueva venta")').first().click(); await mp.waitForTimeout(900) }
    } catch (e) { /* se reporta abajo */ }
  }
  check('offline', 'se pueden registrar ventas sin internet', vendidasOffline === 2, `solo ${vendidasOffline} de 2`)

  const pendientes = await mp.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ventory-offline')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('operaciones-pendientes', 'readonly')
        const all = tx.objectStore('operaciones-pendientes').getAll()
        all.onsuccess = () => resolve(all.result.length)
        all.onerror = () => resolve(-1)
      }
      req.onerror = () => resolve(-1)
    })
  })
  check('offline', 'las ventas quedan guardadas en el dispositivo', pendientes === 2, `${pendientes} en la cola`)

  const stockDuranteOffline = (await S.get(`/api/products/${prod.id}`)).data.product.stock
  check('offline', 'el stock del servidor NO cambia mientras están sin sincronizar', stockDuranteOffline === stockAntes, `${stockAntes} → ${stockDuranteOffline}`)

  // volver la conexión
  await mobile.setOffline(false)
  await mp.waitForTimeout(1000)
  await mp.reload()
  await mp.waitForTimeout(6000)

  const pendientesDespues = await mp.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ventory-offline')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('operaciones-pendientes', 'readonly')
        const all = tx.objectStore('operaciones-pendientes').getAll()
        all.onsuccess = () => resolve(all.result.length)
        all.onerror = () => resolve(-1)
      }
      req.onerror = () => resolve(-1)
    })
  })
  check('offline', 'la cola queda vacía tras recuperar la conexión', pendientesDespues === 0, `${pendientesDespues} sin enviar`)

  const stockFinal = (await S.get(`/api/products/${prod.id}`)).data.product.stock
  check('offline', 'el inventario se descuenta al sincronizar (2 unidades)', stockFinal === stockAntes - 2, `${stockAntes} → ${stockFinal}`)

  const ventasServidor = (await S.get('/api/sales')).data.sales ?? []
  check('offline', 'las ventas offline quedan registradas en el servidor', ventasServidor.length >= 3, `${ventasServidor.length} ventas`)

  await browser.close()
  process.exit(summary() > 0 ? 1 : 0)
})().catch(e => { console.error('ERROR EN LA PRUEBA:', e.message); process.exit(2) })
