// PRUEBA 2: ventas, caja, devoluciones, compras, crédito — casos normales y borde
const { check, summary, newBrowser, registerAndLogin } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Operación ${t}`, name: 'Olga QA', email: `op-${t}@test.com`, password: 'ClaveSegura99',
  })
  const branchId = (await S.get('/api/branches')).data.branches[0].id

  // ── VENTA SIN CAJA ABIERTA ──
  const prod = (await S.post('/api/products', { name: `Prod ${t}`, price: 10000, cost: 6000, branchId, initialStock: 100 })).data.product
  const sinCaja = await S.post('/api/sales', {
    cashSessionId: 'inexistente', items: [{ productId: prod.id, quantity: 1, unitPrice: 10000 }],
    paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 10000, card: 0, transfer: 0 },
  })
  check('caja', 'no se puede vender sin caja abierta', sinCaja.status === 400, `status ${sinCaja.status}`)

  // ── ABRIR CAJA ──
  const abrir = await S.post('/api/cash-registers/open', { branchId, openingBalance: 100000 })
  check('caja', 'abrir caja con base 100.000', abrir.status === 201 || abrir.status === 200, `status ${abrir.status}`)
  const sid = (await S.get('/api/cash-registers/current')).data.session.id

  const dobleApertura = await S.post('/api/cash-registers/open', { branchId, openingBalance: 50000 })
  check('caja', 'no se puede abrir una segunda caja en la misma sucursal', dobleApertura.status >= 400, `status ${dobleApertura.status}`)

  // ── VENTAS: cada método ──
  const vender = (body) => S.post('/api/sales', { cashSessionId: sid, ...body })
  const item = (q = 1, price = 10000) => [{ productId: prod.id, quantity: q, unitPrice: price }]

  const efectivoExacto = await vender({ items: item(1), paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 10000, card: 0, transfer: 0 } })
  check('ventas', 'efectivo exacto', efectivoExacto.status === 201 && efectivoExacto.data.sale.changeGiven === 0, `cambio ${efectivoExacto.data.sale?.changeGiven}`)

  const conCambio = await vender({ items: item(1), paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 20000, card: 0, transfer: 0 } })
  check('ventas', 'efectivo con cambio correcto (20.000 − 10.000)', conCambio.data.sale?.changeGiven === 10000, `cambio ${conCambio.data.sale?.changeGiven}`)

  const tarjeta = await vender({ items: item(1), paymentMethod: 'CARD', payments: { cashActive: false, cashReceived: 0, card: 10000, transfer: 0 } })
  check('ventas', 'tarjeta registra método CARD', tarjeta.data.sale?.paymentMethod === 'CARD', `método ${tarjeta.data.sale?.paymentMethod}`)

  const transf = await vender({ items: item(1), paymentMethod: 'TRANSFER', payments: { cashActive: false, cashReceived: 0, card: 0, transfer: 10000 } })
  check('ventas', 'transferencia registra método TRANSFER', transf.data.sale?.paymentMethod === 'TRANSFER', `método ${transf.data.sale?.paymentMethod}`)

  const mixto = await vender({ items: item(2), paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 5000, card: 15000, transfer: 0 } })
  const pagosMixto = (mixto.data.sale?.payments ?? []).map(p => `${p.method}:${p.amount}`).sort().join(' ')
  check('ventas', 'pago mixto guarda ambos métodos con sus montos', mixto.data.sale?.paymentMethod === 'MIXED' && pagosMixto === 'CARD:15000 CASH:5000', pagosMixto)

  const insuficiente = await vender({ items: item(1), paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 3000, card: 0, transfer: 0 } })
  check('ventas', 'rechaza pago insuficiente', insuficiente.status === 400, `status ${insuficiente.status}`)

  const sinStock = await vender({ items: item(99999), paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 999999999, card: 0, transfer: 0 } })
  check('ventas', 'rechaza venta sin stock suficiente', sinStock.status === 422, `status ${sinStock.status}`)

  const creditoSinCliente = await vender({ items: item(1), paymentMethod: 'CREDIT' })
  check('ventas', 'crédito sin cliente es rechazado', creditoSinCliente.status === 400, `status ${creditoSinCliente.status}`)

  // descuentos
  const dscPesos = await vender({ items: item(1), paymentMethod: 'CASH', discount: 2000, discountIsPct: false, payments: { cashActive: true, cashReceived: 8000, card: 0, transfer: 0 } })
  check('descuentos', 'descuento de $2.000 sobre 10.000 → total 8.000', dscPesos.data.sale?.total === 8000, `total ${dscPesos.data.sale?.total}`)

  const dscPct = await vender({ items: item(1), paymentMethod: 'CASH', discount: 10, discountIsPct: true, payments: { cashActive: true, cashReceived: 9000, card: 0, transfer: 0 } })
  check('descuentos', 'descuento del 10% sobre 10.000 → total 9.000', dscPct.data.sale?.total === 9000, `total ${dscPct.data.sale?.total}`)

  const dscItem = await vender({ items: [{ productId: prod.id, quantity: 2, unitPrice: 10000, discountPct: 50 }], paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 10000, card: 0, transfer: 0 } })
  check('descuentos', 'descuento 50% por artículo (2×10.000) → total 10.000', dscItem.data.sale?.total === 10000, `total ${dscItem.data.sale?.total}`)

  const dscExcesivo = await vender({ items: item(1), paymentMethod: 'CASH', discount: 999999, discountIsPct: false, payments: { cashActive: true, cashReceived: 0, card: 0, transfer: 0 } })
  check('descuentos', 'descuento mayor al total no deja el total negativo', dscExcesivo.status !== 201 || dscExcesivo.data.sale?.total >= 0, `total ${dscExcesivo.data.sale?.total}`)

  // ── CRÉDITO Y ABONOS ──
  const cliente = (await S.post('/api/customers', { name: `Cliente ${t}`, phone: '3009998877' })).data.customer
  const ventaCredito = await vender({ items: item(3), paymentMethod: 'CREDIT', customerId: cliente.id })
  check('crédito', 'venta a crédito registrada', ventaCredito.status === 201, `status ${ventaCredito.status}`)
  const saldo1 = (await S.get(`/api/customers/${cliente.id}`)).data.customer?.balance
  check('crédito', 'el saldo del cliente sube al total fiado (30.000)', Number(saldo1) === 30000, `saldo ${saldo1}`)

  const abono = await S.post(`/api/customers/${cliente.id}/payments`, { amount: 10000, method: 'CASH' })
  const saldo2 = (await S.get(`/api/customers/${cliente.id}`)).data.customer?.balance
  check('crédito', 'abono de 10.000 baja el saldo a 20.000', Number(saldo2) === 20000, `saldo ${saldo2}`)

  const abonoExcesivo = await S.post(`/api/customers/${cliente.id}/payments`, { amount: 999999, method: 'CASH' })
  const saldo3 = (await S.get(`/api/customers/${cliente.id}`)).data.customer?.balance
  check('crédito', 'un abono mayor a la deuda no deja saldo negativo', Number(saldo3) >= 0, `saldo ${saldo3}`)

  // ── DEVOLUCIONES Y ANULACIONES ──
  const ventaDev = await vender({ items: item(5), paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 50000, card: 0, transfer: 0 } })
  const saleId = ventaDev.data.sale.id, itemId = ventaDev.data.sale.items[0].id
  const stockAntesDev = (await S.get(`/api/products/${prod.id}`)).data.product.stock

  const devParcial = await S.post(`/api/sales/${saleId}/return`, { items: [{ saleItemId: itemId, quantity: 2 }], exchange: false })
  const stockDespDev = (await S.get(`/api/products/${prod.id}`)).data.product.stock
  check('devoluciones', 'devolución parcial de 2 regresa el stock', devParcial.status === 200 || devParcial.status === 201, `status ${devParcial.status}`)
  check('devoluciones', 'stock sube exactamente 2 tras la devolución', stockDespDev === stockAntesDev + 2, `${stockAntesDev} → ${stockDespDev}`)

  const devExcesiva = await S.post(`/api/sales/${saleId}/return`, { items: [{ saleItemId: itemId, quantity: 99 }], exchange: false })
  const stockTrasExcesiva = (await S.get(`/api/products/${prod.id}`)).data.product.stock
  check('devoluciones', 'no se puede devolver más de lo vendido', stockTrasExcesiva <= stockAntesDev + 5, `stock ${stockTrasExcesiva} (tope ${stockAntesDev + 5})`)

  const ventaAnular = await vender({ items: item(4), paymentMethod: 'CASH', payments: { cashActive: true, cashReceived: 40000, card: 0, transfer: 0 } })
  const stockAntesAnul = (await S.get(`/api/products/${prod.id}`)).data.product.stock
  const anular = await S.post(`/api/sales/${ventaAnular.data.sale.id}/void`, {})
  const stockDespAnul = (await S.get(`/api/products/${prod.id}`)).data.product.stock
  check('anulaciones', 'anulación devuelve las 4 unidades', stockDespAnul === stockAntesAnul + 4, `${stockAntesAnul} → ${stockDespAnul}`)

  const doblreAnul = await S.post(`/api/sales/${ventaAnular.data.sale.id}/void`, {})
  check('anulaciones', 'no se puede anular dos veces la misma venta', doblreAnul.status >= 400, `status ${doblreAnul.status}`)

  // ── COMPRAS ──
  const compraContado = await S.post('/api/purchases', { branchId, supplierName: `Prov ${t}`, method: 'CASH', items: [{ productId: prod.id, quantity: 10, unitCost: 6000 }] })
  check('compras', 'compra de contado registrada', compraContado.status === 201, `status ${compraContado.status}`)
  const movs = (await S.get('/api/cash-movements')).data.movements ?? []
  const gastoProv = movs.find(m => m.description?.includes('proveedor') && Number(m.amount) === 60000)
  check('compras', 'la compra de contado genera gasto de caja de 60.000', !!gastoProv, gastoProv ? '' : 'no se encontró el gasto')

  const compraCredito = await S.post('/api/purchases', { branchId, supplierName: `Prov ${t}`, method: 'CREDIT', initialPayment: 20000, items: [{ productId: prod.id, quantity: 10, unitCost: 6000 }] })
  const saldoProv = compraCredito.data.purchase?.balance
  check('compras', 'compra a crédito con abono deja saldo 40.000', Number(saldoProv) === 40000, `saldo ${saldoProv}`)

  const abonoProv = await S.post(`/api/purchases/${compraCredito.data.purchase.id}/payments`, { amount: 40000, method: 'CASH' })
  check('compras', 'abono al proveedor salda la compra', abonoProv.status === 200 || abonoProv.status === 201, `status ${abonoProv.status}`)

  // ── MOVIMIENTOS DE CAJA ──
  const ingreso = await S.post('/api/cash-movements', { type: 'INCOME', description: 'Otro ingreso', amount: 15000 })
  const gasto = await S.post('/api/cash-movements', { type: 'EXPENSE', description: 'Domicilios', amount: 5000 })
  check('caja', 'registrar ingreso y gasto de caja', ingreso.status < 300 && gasto.status < 300, `${ingreso.status}/${gasto.status}`)

  const negativo = await S.post('/api/cash-movements', { type: 'EXPENSE', description: 'Malo', amount: -100 })
  check('caja', 'rechaza montos negativos en movimientos', negativo.status >= 400, `status ${negativo.status}`)

  // ── CIERRE DE CAJA ──
  const resumen = (await S.get('/api/cash-registers/current')).data.summary
  const esperado = resumen.expectedBalance
  const cierreConDif = await S.post(`/api/cash-registers/${sid}/close`, { closingBalance: esperado - 50000, openNext: false })
  check('cierre', 'exige observación cuando la diferencia supera el umbral', cierreConDif.status === 422, `status ${cierreConDif.status}`)

  const cierreOk = await S.post(`/api/cash-registers/${sid}/close`, { closingBalance: esperado, openNext: false })
  check('cierre', 'cierre exacto acepta y calcula diferencia 0', cierreOk.status === 200 && cierreOk.data.summary?.difference === 0, `dif ${cierreOk.data.summary?.difference}`)
  check('cierre', 'el recibo trae el desglose por método de pago', Object.keys(cierreOk.data.report?.byMethod ?? {}).length > 0, JSON.stringify(cierreOk.data.report?.byMethod))
  check('cierre', 'el recibo reporta ventas a crédito del turno', (cierreOk.data.report?.creditSales?.count ?? 0) > 0, JSON.stringify(cierreOk.data.report?.creditSales))
  check('cierre', 'el recibo reporta abonos de clientes', (cierreOk.data.report?.customerPayments?.count ?? 0) > 0, JSON.stringify(cierreOk.data.report?.customerPayments))
  check('cierre', 'el recibo reporta compras del turno', (cierreOk.data.report?.purchases?.count ?? 0) > 0, JSON.stringify(cierreOk.data.report?.purchases))

  const cierreRepetido = await S.post(`/api/cash-registers/${sid}/close`, { closingBalance: 1000, openNext: false })
  check('cierre', 'no se puede cerrar dos veces el mismo turno', cierreRepetido.status >= 400, `status ${cierreRepetido.status}`)

  await browser.close()
  process.exit(summary() > 0 ? 1 : 0)
})().catch(e => { console.error('ERROR EN LA PRUEBA:', e.message); process.exit(2) })
