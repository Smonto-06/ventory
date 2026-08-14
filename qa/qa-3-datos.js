// PRUEBA 3: productos, inventario, importación, reportes, plan, export, auth
const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Datos ${t}`, name: 'Diana QA', email: `dat-${t}@test.com`, password: 'ClaveSegura99',
  })
  const branchId = (await S.get('/api/branches')).data.branches[0].id

  // ── PRODUCTOS ──
  const minimo = await S.post('/api/products', { name: `Solo nombre ${t}`, price: 3000, branchId, initialStock: 0 })
  check('productos', 'crear producto solo con nombre y precio (sin SKU ni código)', minimo.status === 201, `status ${minimo.status}`)
  check('productos', 'stock inicial 0 queda en 0', minimo.data.product?.stock === 0, `stock ${minimo.data.product?.stock}`)

  const sinPrecio = await S.post('/api/products', { name: `Sin precio ${t}`, price: 0, branchId })
  check('productos', 'rechaza precio en 0', sinPrecio.status === 400, `status ${sinPrecio.status}`)

  const sinNombre = await S.post('/api/products', { name: '', price: 1000, branchId })
  check('productos', 'rechaza producto sin nombre', sinNombre.status === 400, `status ${sinNombre.status}`)

  const costoMayor = await S.post('/api/products', { name: `Costo alto ${t}`, price: 1000, cost: 5000, branchId })
  check('productos', 'rechaza costo mayor al precio de venta', costoMayor.status === 400, `status ${costoMayor.status}`)

  const conSku = await S.post('/api/products', { name: `Con SKU ${t}`, price: 5000, sku: `SKU-${t}`, branchId, initialStock: 5, minStock: 5 })
  const skuRepetido = await S.post('/api/products', { name: `Otro ${t}`, price: 6000, sku: `SKU-${t}`, branchId })
  check('productos', 'rechaza SKU duplicado en el mismo negocio', skuRepetido.status >= 400, `status ${skuRepetido.status}`)

  const porPeso = await S.post('/api/products', { name: `Verdura ${t}`, price: 8000, unitOfMeasure: 'kg', branchId, initialStock: 10.5 })
  check('productos', 'producto por peso acepta stock decimal (10,5 kg)', porPeso.data.product?.stock === 10.5, `stock ${porPeso.data.product?.stock}`)

  // ── IMPORTACIÓN ──
  const imp = await S.post('/api/products/import', {
    rows: [
      { name: `Imp Uno ${t}`, price: 1500, stock: 10, minStock: 2, unit: 'und', category: 'Importados' },
      { name: `Imp Dos ${t}`, price: 2500, stock: 3.5, minStock: 1, unit: 'kg', category: 'Importados' },
      { name: `Imp Uno ${t}`, price: 1500, stock: 5, minStock: 0, unit: 'und' }, // duplicado
    ],
  })
  check('importación', 'importa 2 productos y omite el duplicado', imp.data.created === 2 && imp.data.skipped?.length === 1, JSON.stringify({ c: imp.data.created, s: imp.data.skipped?.length }))
  const cats = (await S.get('/api/categories')).data.categories ?? []
  check('importación', 'crea automáticamente la categoría del archivo', cats.some(c => c.name === 'Importados'), cats.map(c => c.name).join(','))

  const impVacio = await S.post('/api/products/import', { rows: [] })
  check('importación', 'rechaza importación vacía', impVacio.status === 400, `status ${impVacio.status}`)

  // ── INVENTARIO ──
  const pid = conSku.data.product.id
  const ajuste = await S.post('/api/inventory/adjust', { branchId, adjustments: [{ productId: pid, quantity: 25 }], reason: 'Conteo' })
  const trasAjuste = (await S.get(`/api/products/${pid}`)).data.product.stock
  check('inventario', 'ajuste por conteo físico fija el stock en 25', trasAjuste === 25, `stock ${trasAjuste}`)

  const kardex = (await S.get(`/api/inventory/movements?productId=${pid}`)).data.movements ?? []
  check('inventario', 'el ajuste queda registrado en el kardex con antes y después', kardex.some(m => m.type === 'ADJUSTMENT' && Number(m.quantityAfter) === 25), `${kardex.length} movimientos`)

  const bajo = await S.post('/api/inventory/adjust', { branchId, adjustments: [{ productId: pid, quantity: 1 }], reason: 'Casi agotado' })
  const lowStock = (await S.get('/api/inventory/low-stock')).data
  check('inventario', 'el producto aparece en la alerta de stock bajo', JSON.stringify(lowStock).includes(pid), 'no aparece')

  // segunda sucursal para probar traslado
  const suc2 = await S.post('/api/branches', { name: `Bodega ${t}` })
  const br2 = suc2.data.branch.id
  await S.post('/api/inventory/adjust', { branchId, adjustments: [{ productId: pid, quantity: 20 }], reason: 'Reponer' })
  const salida = await S.post('/api/inventory/transfer', { productId: pid, branchId, direction: 'out', quantity: 5 })
  const entrada = await S.post('/api/inventory/transfer', { productId: pid, branchId: br2, direction: 'in', quantity: 5 })
  check('inventario', 'traslado saca de una sucursal y entra en otra', salida.status < 300 && entrada.status < 300, `${salida.status}/${entrada.status}`)

  const trasladoExcesivo = await S.post('/api/inventory/transfer', { productId: pid, branchId, direction: 'out', quantity: 99999 })
  check('inventario', 'rechaza trasladar más stock del que hay', trasladoExcesivo.status >= 400, `status ${trasladoExcesivo.status}`)

  // ── VENTAS EN ESPERA ──
  const espera = await S.post('/api/held-sales', { customerName: 'Cliente espera', total: 15000, itemCount: 2, payload: { cart: [], discount: 0, discountIsPct: false, customer: '' } })
  check('esperas', 'guardar una venta en espera', espera.status === 201 || espera.status === 200, `status ${espera.status}`)
  const esperas = (await S.get('/api/held-sales')).data.heldSales ?? []
  check('esperas', 'la venta en espera aparece en la lista', esperas.length > 0, `${esperas.length}`)
  if (esperas.length) {
    const borrar = await S.del(`/api/held-sales/${esperas[0].id}`)
    check('esperas', 'descartar una venta en espera', borrar.status < 300, `status ${borrar.status}`)
  }

  // ── REPORTES ──
  await S.post('/api/cash-registers/open', { branchId, openingBalance: 50000 })
  const sid = (await S.get('/api/cash-registers/current')).data.session.id
  await S.post('/api/sales', { cashSessionId: sid, items: [{ productId: pid, quantity: 2, unitPrice: 5000 }], paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 10000, card: 0, transfer: 0 } })

  const diario = await S.get('/api/reports/daily')
  check('reportes', 'reporte diario responde con totales', diario.status === 200 && diario.data.summary?.totalSales > 0, `ventas ${diario.data.summary?.totalSales}`)
  check('reportes', 'el reporte calcula utilidad', typeof diario.data.profit?.net === 'number', JSON.stringify(diario.data.profit))

  const hoy = new Date().toISOString().slice(0, 10)
  const rango = await S.get(`/api/reports/range?from=${hoy}&to=${hoy}`)
  check('reportes', 'reporte por rango responde con comparativa', rango.status === 200 && rango.data.comparison !== undefined, `status ${rango.status}`)

  const rangoInvertido = await S.get(`/api/reports/range?from=${hoy}&to=2020-01-01`)
  check('reportes', 'rechaza rango de fechas invertido', rangoInvertido.status === 400, `status ${rangoInvertido.status}`)

  const rangoEnorme = await S.get(`/api/reports/range?from=2000-01-01&to=${hoy}`)
  check('reportes', 'rechaza rango mayor a un año', rangoEnorme.status === 400, `status ${rangoEnorme.status}`)

  // ── ELIMINAR PRODUCTOS ──
  // Sin historial se borra de verdad; con historial (pid ya se vendió y se
  // movió arriba) se protege y se pide archivar en su lugar.
  const borrable = await S.post('/api/products', { name: `Borrable ${t}`, price: 2000, branchId, initialStock: 3 })
  const delOk = await S.del(`/api/products/${borrable.data.product.id}?eliminar=1`)
  check('productos', 'un producto SIN historial se elimina de verdad', delOk.status === 200, `status ${delOk.status}`)
  const yaNoEsta = await S.get(`/api/products/${borrable.data.product.id}`)
  check('productos', 'y desaparece del catálogo', yaNoEsta.status === 404, `status ${yaNoEsta.status}`)

  const delConHistorial = await S.del(`/api/products/${pid}?eliminar=1`)
  check('productos', 'un producto CON historial no se elimina (409, pide archivar)', delConHistorial.status === 409, `status ${delConHistorial.status}`)
  check('productos', 'con la explicación del historial', /historial/.test(delConHistorial.data?.error ?? ''), delConHistorial.data?.error)
  const sigueActivo = await S.get(`/api/products/${pid}`)
  check('productos', 'y sigue existiendo (no se tocó)', sigueActivo.status === 200 && sigueActivo.data.product?.status === 'ACTIVE', `status ${sigueActivo.status}`)

  // sin el parámetro ?eliminar=1, DELETE sigue archivando como siempre
  const archivable = await S.post('/api/products', { name: `Archivable ${t}`, price: 2000, branchId })
  const archivado = await S.del(`/api/products/${archivable.data.product.id}`)
  check('productos', 'DELETE sin ?eliminar=1 sigue archivando (compatibilidad)', archivado.status === 200, `status ${archivado.status}`)
  const archivadoLeido = await S.get(`/api/products/${archivable.data.product.id}`)
  check('productos', 'el producto archivado no aparece en la lista activa', !(await S.get('/api/products')).data.products.some(p => p.id === archivable.data.product.id), 'sigue en la lista')
  check('productos', 'pero se puede consultar directo (no se borró)', archivadoLeido.status === 200 && archivadoLeido.data.product?.status === 'ARCHIVED', `status ${archivadoLeido.status}`)

  // ── EXPORTACIONES ──
  const tipos = ['sales', 'products', 'customers', 'purchases']
  let exportOk = true, detalle = []
  for (const tipo of tipos) {
    const r = await S.page.evaluate(async (u) => {
      const res = await fetch(u)
      const txt = await res.text()
      return { status: res.status, lineas: txt.trim().split('\n').length }
    }, `/api/export?type=${tipo}`)
    if (r.status !== 200 || r.lineas < 1) { exportOk = false; detalle.push(`${tipo}:${r.status}`) }
  }
  check('exportar', 'los 4 CSV se generan correctamente', exportOk, detalle.join(','))

  const backup = await S.get('/api/export?type=backup')
  check('exportar', 'el respaldo completo trae el negocio y sus datos', backup.status === 200 && !!backup.data.negocio && Array.isArray(backup.data.productos), `status ${backup.status}`)

  const tipoInvalido = await S.get('/api/export?type=inventado')
  check('exportar', 'rechaza un tipo de exportación inválido', tipoInvalido.status === 400, `status ${tipoInvalido.status}`)

  // ── DASHBOARD Y AUDITORÍA ──
  const dash = await S.get('/api/dashboard')
  check('panel', 'el panel responde con los datos del día', dash.status === 200, `status ${dash.status}`)
  const audit = await S.get('/api/audit')
  check('auditoría', 'el registro de actividad lista eventos', audit.status === 200 && (audit.data.logs?.length ?? 0) > 0, `${audit.data.logs?.length} eventos`)

  // ── AUTENTICACIÓN ──
  const anon = await browser.newContext()
  const ap = await anon.newPage()
  await ap.goto(BASE + '/login')
  const authTests = await ap.evaluate(async (email) => {
    const post = async (u, b) => { const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, data: await r.json().catch(() => null) } }
    return {
      // registro con correo repetido
      duplicado: (await post('/api/auth/register', { name: 'Repetido', email, password: 'ClaveSegura99', businessName: 'Otro Negocio' })).status,
      // contraseña corta
      corta: (await post('/api/auth/register', { name: 'Corta', email: 'nuevo' + Date.now() + '@t.com', password: '123', businessName: 'Otro Negocio' })).status,
      // recuperación: respuesta uniforme (no revela si el correo existe)
      forgotExiste: (await post('/api/auth/forgot', { email })).status,
      forgotNoExiste: (await post('/api/auth/forgot', { email: 'noexiste-xyz@nada.com' })).status,
      // token de verificación inválido
      verifyMalo: (await post('/api/auth/verify', { token: 'token-inventado' })).status,
      // reset con token inválido
      resetMalo: (await post('/api/auth/reset', { token: 'malo', password: 'NuevaClave123' })).status,
    }
  }, `dat-${t}@test.com`)
  check('auth', 'rechaza registro con correo ya usado', authTests.duplicado === 409, `status ${authTests.duplicado}`)
  check('auth', 'rechaza contraseña de menos de 8 caracteres', authTests.corta === 400, `status ${authTests.corta}`)
  check('auth', 'recuperación no revela si el correo existe', authTests.forgotExiste === authTests.forgotNoExiste, `${authTests.forgotExiste} vs ${authTests.forgotNoExiste}`)
  check('auth', 'rechaza token de verificación inválido', authTests.verifyMalo === 400, `status ${authTests.verifyMalo}`)
  check('auth', 'rechaza token de recuperación inválido', authTests.resetMalo === 400, `status ${authTests.resetMalo}`)
  await anon.close()

  await browser.close()
  process.exit(summary() > 0 ? 1 : 0)
})().catch(e => { console.error('ERROR EN LA PRUEBA:', e.message); process.exit(2) })
