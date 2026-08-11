// PRUEBA 1: aislamiento entre negocios + permisos por rol
const { check, summary, newBrowser, registerAndLogin, loginOnly } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)

  // Dos negocios independientes
  const A = await registerAndLogin(browser, {
    businessName: `Negocio A ${t}`, name: 'Ana Admin', email: `a-${t}@test.com`, password: 'ClaveSegura99',
  })
  const B = await registerAndLogin(browser, {
    businessName: `Negocio B ${t}`, name: 'Beto Admin', email: `b-${t}@test.com`, password: 'ClaveSegura99',
  })
  check('setup', 'dos negocios creados e iniciada sesión', true)

  // Cada uno crea su producto y su cliente
  const brA = (await A.get('/api/branches')).data.branches[0].id
  const brB = (await B.get('/api/branches')).data.branches[0].id
  const prodA = await A.post('/api/products', { name: `Producto A ${t}`, price: 5000, branchId: brA, initialStock: 10 })
  const prodB = await B.post('/api/products', { name: `Producto B ${t}`, price: 7000, branchId: brB, initialStock: 10 })
  const cliA = await A.post('/api/customers', { name: `Cliente A ${t}`, phone: '3001112233' })
  const idProdA = prodA.data.product.id, idProdB = prodB.data.product.id, idCliA = cliA.data.customer?.id

  // ── AISLAMIENTO: B no debe ver ni tocar nada de A ──
  const listaB = await B.get('/api/products')
  const veProductoDeA = (listaB.data.products ?? []).some(p => p.id === idProdA)
  check('aislamiento', 'B NO ve los productos de A en su lista', !veProductoDeA, veProductoDeA ? 'FUGA DE DATOS' : '')

  const leerProdA = await B.get(`/api/products/${idProdA}`)
  check('aislamiento', 'B NO puede leer un producto de A por id', leerProdA.status === 404, `status ${leerProdA.status}`)

  const editarProdA = await B.patch(`/api/products/${idProdA}`, { price: 1 })
  check('aislamiento', 'B NO puede editar un producto de A', editarProdA.status === 404 || editarProdA.status === 403, `status ${editarProdA.status}`)

  const borrarProdA = await B.del(`/api/products/${idProdA}`)
  check('aislamiento', 'B NO puede archivar un producto de A', borrarProdA.status === 404 || borrarProdA.status === 403, `status ${borrarProdA.status}`)

  const clientesB = await B.get('/api/customers')
  const veClienteDeA = (clientesB.data.customers ?? []).some(c => c.id === idCliA)
  check('aislamiento', 'B NO ve los clientes de A', !veClienteDeA, veClienteDeA ? 'FUGA DE DATOS' : '')

  if (idCliA) {
    const leerCliA = await B.get(`/api/customers/${idCliA}`)
    check('aislamiento', 'B NO puede leer un cliente de A', leerCliA.status === 404, `status ${leerCliA.status}`)
  }

  // B intenta vender un producto de A usando su propia caja
  await B.post('/api/cash-registers/open', { branchId: brB, openingBalance: 50000 })
  const cajaB = (await B.get('/api/cash-registers/current')).data.session
  const ventaCruzada = await B.post('/api/sales', {
    cashSessionId: cajaB.id,
    items: [{ productId: idProdA, quantity: 1, unitPrice: 5000 }],
    paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 5000, card: 0, transfer: 0 },
  })
  check('aislamiento', 'B NO puede vender un producto de A', ventaCruzada.status === 400, `status ${ventaCruzada.status}`)

  // B intenta abrir caja en la sucursal de A
  const cajaCruzada = await B.post('/api/cash-registers/open', { branchId: brA, openingBalance: 1000 })
  check('aislamiento', 'B NO puede abrir caja en la sucursal de A', cajaCruzada.status >= 400, `status ${cajaCruzada.status}`)

  // B intenta ajustar el inventario de A
  const ajusteCruzado = await B.post('/api/inventory/adjust', { branchId: brA, adjustments: [{ productId: idProdA, quantity: 999 }] })
  check('aislamiento', 'B NO puede ajustar inventario de A', ajusteCruzado.status >= 400, `status ${ajusteCruzado.status}`)

  // B intenta renombrar la sucursal de A
  const sucCruzada = await B.patch(`/api/branches/${brA}`, { name: 'Hackeada' })
  check('aislamiento', 'B NO puede modificar la sucursal de A', sucCruzada.status === 404 || sucCruzada.status === 403, `status ${sucCruzada.status}`)

  // B intenta entrar al panel de plataforma
  const adminB = await B.get('/api/admin/businesses')
  check('aislamiento', 'B NO puede listar todos los negocios (panel super admin)', adminB.status === 403, `status ${adminB.status}`)

  // ── PERMISOS POR ROL: cajero de A ──
  const cajero = await A.post('/api/users', {
    name: 'Carlos Cajero', email: `caja-${t}@test.com`, password: 'ClaveCajero99', role: 'CASHIER',
  })
  check('roles', 'admin puede crear un cajero', cajero.status === 201 || cajero.status === 200, `status ${cajero.status}`)

  if (cajero.status < 300) {
    const C = await loginOnly(browser, `caja-${t}@test.com`, 'ClaveCajero99')
    const rep = await C.get('/api/reports/daily')
    check('roles', 'cajero NO puede ver reportes', rep.status === 403, `status ${rep.status}`)
    const aud = await C.get('/api/audit')
    check('roles', 'cajero NO puede ver la auditoría', aud.status === 403, `status ${aud.status}`)
    const exp = await C.get('/api/export?type=sales')
    check('roles', 'cajero NO puede exportar datos', exp.status === 403, `status ${exp.status}`)
    const aj = await C.post('/api/inventory/adjust', { branchId: brA, adjustments: [{ productId: idProdA, quantity: 500 }] })
    check('roles', 'cajero NO puede ajustar inventario', aj.status === 403, `status ${aj.status}`)
    const usr = await C.post('/api/users', { name: 'X', email: `x-${t}@t.com`, password: 'Clave12345', role: 'ADMIN' })
    check('roles', 'cajero NO puede crear usuarios', usr.status === 403, `status ${usr.status}`)
    const cfg = await C.put('/api/settings', { name: 'Cambiado por cajero' })
    check('roles', 'cajero NO puede cambiar los ajustes del negocio', cfg.status === 403, `status ${cfg.status}`)
    const comp = await C.get('/api/purchases')
    check('roles', 'cajero NO puede ver compras', comp.status === 403, `status ${comp.status}`)
    const prods = await C.get('/api/products')
    check('roles', 'cajero SÍ puede ver productos (para vender)', prods.status === 200, `status ${prods.status}`)
    await C.ctx.close()
  }

  // ── ROL ENCARGADO (SUPERVISOR) ──
  // Opera el negocio sin el dueño presente: compras e inventario SÍ;
  // usuarios, ajustes del negocio, plan y respaldos NO.
  const enc = await A.post('/api/users', {
    name: 'Encargada Rosa', email: `enc-${t}@test.com`, password: 'ClaveEncargada99', role: 'SUPERVISOR',
  })
  check('roles', 'admin puede crear un encargado', enc.status === 201 || enc.status === 200, `status ${enc.status}`)
  if (enc.status === 201 || enc.status === 200) {
    const E = await loginOnly(browser, `enc-${t}@test.com`, 'ClaveEncargada99')
    const provE = await E.post('/api/suppliers', { name: `Proveedor Enc ${t}` })
    check('roles', 'encargado SÍ puede crear proveedores', provE.status === 201, `status ${provE.status}`)
    const compE = await E.post('/api/purchases', {
      supplierId: provE.data?.supplier?.id, branchId: brA, method: 'TRANSFER',
      items: [{ productId: idProdA, quantity: 5, unitCost: 1000 }],
    })
    check('roles', 'encargado SÍ puede ingresar compras', compE.status === 201, `status ${compE.status}`)
    const ajE = await E.post('/api/inventory/adjust', { adjustments: [{ productId: idProdA, quantity: 30 }] })
    check('roles', 'encargado SÍ puede ajustar inventario', ajE.status === 200 || ajE.status === 201, `status ${ajE.status}`)
    const repE = await E.get(`/api/reports/daily?date=${new Date().toISOString().slice(0, 10)}`)
    check('roles', 'encargado SÍ puede ver reportes', repE.status === 200, `status ${repE.status}`)
    const usrE = await E.post('/api/users', { name: 'X', email: `xe-${t}@t.com`, password: 'Clave12345', role: 'ADMIN' })
    check('roles', 'encargado NO puede crear usuarios', usrE.status === 403, `status ${usrE.status}`)
    const cfgE = await E.put('/api/settings', { name: 'Cambiado por encargado' })
    check('roles', 'encargado NO puede cambiar los ajustes del negocio', cfgE.status === 403, `status ${cfgE.status}`)
    const expE = await E.get('/api/export?type=backup')
    check('roles', 'encargado NO puede exportar respaldos', expE.status === 403, `status ${expE.status}`)
    const planE = await E.post('/api/plan/checkout')
    check('roles', 'encargado NO puede pagar el plan', planE.status === 403, `status ${planE.status}`)
    await E.ctx.close()

    // ── ELIMINAR EMPLEADOS ──
    // Sin historial se borra de verdad; con historial (el encargado ya
    // compró) se protege el historial y se pide desactivar; nadie se borra
    // a sí mismo.
    const borrable = await A.post('/api/users', {
      name: 'Creado Por Error', email: `error-${t}@test.com`, password: 'ClaveSegura99', role: 'CASHIER',
    })
    const usuariosA = (await A.get('/api/users')).data.users
    const idBorrable = borrable.data?.user?.id ?? usuariosA.find((u) => u.email === `error-${t}@test.com`)?.id
    const delOk = await A.del(`/api/users/${idBorrable}`)
    check('roles', 'un empleado SIN historial se elimina de verdad', delOk.status === 200, `status ${delOk.status}`)
    const yaNoEsta = !(await A.get('/api/users')).data.users.some((u) => u.id === idBorrable)
    check('roles', 'y desaparece de la lista', yaNoEsta)

    const idEnc = usuariosA.find((u) => u.email === `enc-${t}@test.com`)?.id
    const delConHistorial = await A.del(`/api/users/${idEnc}`)
    check('roles', 'un empleado CON historial no se elimina (409, pide desactivar)', delConHistorial.status === 409, `status ${delConHistorial.status}`)
    check('roles', 'con la explicación del historial', /historial/.test(delConHistorial.data?.error ?? ''), delConHistorial.data?.error)

    const idPropio = usuariosA.find((u) => u.email === `a-${t}@test.com`)?.id
    const delPropio = await A.del(`/api/users/${idPropio}`)
    check('roles', 'el admin no puede eliminarse a sí mismo', delPropio.status === 400, `status ${delPropio.status}`)

    // otro negocio no puede borrar usuarios ajenos
    const delCruzado = await B.del(`/api/users/${idEnc}`)
    check('aislamiento', 'B NO puede eliminar un usuario de A', delCruzado.status === 404 || delCruzado.status === 403, `status ${delCruzado.status}`)
  }

  // ── SIN SESIÓN ──
  const anon = await browser.newContext()
  const anonPage = await anon.newPage()
  await anonPage.goto('http://localhost:3100/login')
  const sinSesion = await anonPage.evaluate(async () => {
    const out = {}
    for (const u of ['/api/products', '/api/sales', '/api/customers', '/api/reports/daily', '/api/export?type=backup', '/api/audit', '/api/admin/businesses']) {
      const r = await fetch(u, { redirect: 'manual' })
      out[u] = r.status
    }
    return out
  })
  // 307 = el middleware redirige al login; 401/403 = el endpoint rechaza
  const todosBloqueados = Object.values(sinSesion).every(s => s === 401 || s === 403 || s === 307 || s === 0)
  check('sin sesión', 'ningún endpoint responde sin iniciar sesión', todosBloqueados, JSON.stringify(sinSesion))
  await anon.close()

  await browser.close()
  process.exit(summary() > 0 ? 1 : 0)
})().catch(e => { console.error('ERROR EN LA PRUEBA:', e.message); process.exit(2) })
