// PRUEBA 13: pasarela de pagos Wompi (mensualidad del plan)
//
// El dueño paga los $49.900 en el checkout de Wompi y la cuenta se activa
// sola: el webhook firmado extiende la vigencia 30 días (o la consulta de
// respaldo, si el webhook se demora). Sin firma válida no entra nada, un
// mismo pago jamás suma dos veces, y un pago rechazado no activa nada.
//
// Requiere el servidor con las llaves de prueba y el Wompi de mentira:
//   node qa/wompi-falso.js &
//   WOMPI_PUBLIC_KEY=pub_test_qa WOMPI_PRIVATE_KEY=prv_test_qa \
//   WOMPI_INTEGRITY_SECRET=integridad-qa WOMPI_EVENTS_SECRET=eventos-qa \
//   WOMPI_API_BASE=http://127.0.0.1:2526 \
//   WOMPI_CHECKOUT_BASE=http://127.0.0.1:2526/p/ node server.js

const { createHash } = require('crypto')
const { check, summary, newBrowser, registerAndLogin, loginOnly, BASE } = require('./qa-lib')

const INTEGRIDAD = process.env.WOMPI_INTEGRITY_SECRET || 'integridad-qa'
const EVENTOS = process.env.WOMPI_EVENTS_SECRET || 'eventos-qa'
const WOMPI_FALSO = process.env.WOMPI_FALSO || 'http://127.0.0.1:2526'

const sha256 = (t) => createHash('sha256').update(t).digest('hex')

// Evento transaction.updated firmado como lo hace Wompi
const eventoFirmado = (tx, secreto = EVENTOS) => {
  const timestamp = Math.floor(Date.now() / 1000)
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
  const checksum = sha256(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${secreto}`)
  return { event: 'transaction.updated', data: { transaction: tx }, timestamp, signature: { properties, checksum } }
}

const txDe = (reference, status, extra = {}) => ({
  id: `txn-${reference}`,
  status,
  reference,
  amount_in_cents: 4990000,
  currency: 'COP',
  payment_method_type: 'NEQUI',
  finalized_at: new Date().toISOString(),
  ...extra,
})

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Pagos ${t}`,
    name: 'Dueño Pagador',
    email: `qa_pago_${t}@test.com`,
    password: 'VentoryQA2026',
  })
  const page = S.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))

  const dias = async () => (await S.get('/api/settings')).data.settings.plan.daysLeft
  const plan = async () => (await S.get('/api/settings')).data.settings.plan

  // ── EL PAGO EN LÍNEA ESTÁ HABILITADO Y EL NEGOCIO EN PRUEBA ──
  const ajustes = (await S.get('/api/settings')).data.settings
  check('pagos', 'el servidor reporta pago en línea habilitado', ajustes.pagoEnLinea === true)
  check('pagos', 'el negocio arranca en prueba de 15 días', ajustes.plan.status === 'TRIAL' && ajustes.plan.daysLeft === 15, JSON.stringify(ajustes.plan))

  // ── LA INTERFAZ EN PRUEBA: BANNER CON BOTÓN QUE LLEVA AL CHECKOUT ──
  await page.goto(BASE + '/app')
  await page.waitForTimeout(3000)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }
  const cuerpo = await page.textContent('body')
  check('pagos', 'el banner de prueba gratis está visible', cuerpo.includes('Prueba gratis'))
  const btnPagar = page.locator('button:has-text("Pagar mi plan")').first()
  check('pagos', 'con el botón "Pagar mi plan · $ 49.900"', (await btnPagar.count()) > 0)
  await btnPagar.click()
  await page.waitForURL('**/p/**', { timeout: 15000 }).catch(() => {})
  const enCheckout = page.url().includes('/p/')
  check('pagos', 'el botón lleva al checkout de Wompi', enCheckout, page.url())
  if (enCheckout) {
    const refMostrada = (await page.textContent('#referencia')).trim()
    check('pagos', 'el checkout recibe una referencia VEN-…', /^VEN-/.test(refMostrada), refMostrada)
    check('pagos', 'y el monto de $49.900 (4.990.000 centavos)', (await page.textContent('#monto')).trim() === '4990000')
  }
  // volver a la app para que los helpers de API sigan funcionando
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2000)

  // ── CREAR EL CHECKOUT POR API ──
  const co = await S.post('/api/plan/checkout')
  check('pagos', 'el checkout se crea (201)', co.status === 201, `status ${co.status}`)
  const url = new URL(co.data.url)
  const ref1 = co.data.reference
  check('pagos', 'cobra exactamente $49.900', url.searchParams.get('amount-in-cents') === '4990000' && co.data.amount === 49900)
  check(
    'pagos',
    'la firma de integridad es la correcta (no se puede alterar el monto)',
    url.searchParams.get('signature:integrity') === sha256(`${ref1}4990000COP${INTEGRIDAD}`),
  )
  check('pagos', 'avisa que está en modo pruebas (sandbox)', co.data.sandbox === true)

  // Un cajero NO puede pagar el plan (solo el administrador)
  await S.post('/api/users', { name: 'Cajero', email: `caj_${t}@test.com`, password: 'VentoryQA2026', role: 'CASHIER' })
  const caj = await loginOnly(browser, `caj_${t}@test.com`, 'VentoryQA2026')
  const coCaj = await caj.post('/api/plan/checkout')
  check('pagos', 'un cajero no puede crear el pago (403)', coCaj.status === 403, `status ${coCaj.status}`)
  await caj.ctx.close()

  // ── EL WEBHOOK EXIGE FIRMA ──
  const malo = await S.post('/api/wompi/eventos', eventoFirmado(txDe(ref1, 'APPROVED'), 'secreto-falso'))
  check('pagos', 'un evento con firma falsa se rechaza (403)', malo.status === 403, `status ${malo.status}`)
  check('pagos', 'y el plan sigue en prueba', (await plan()).status === 'TRIAL')

  const alterado = await S.post('/api/wompi/eventos', eventoFirmado(txDe(ref1, 'APPROVED', { amount_in_cents: 100 })))
  check('pagos', 'un evento con el monto alterado se rechaza (422)', alterado.status === 422, `status ${alterado.status}`)
  check('pagos', 'y el plan sigue en prueba', (await plan()).status === 'TRIAL')

  // ── PAGO APROBADO: LA CUENTA SE ACTIVA SOLA ──
  const ok1 = await S.post('/api/wompi/eventos', eventoFirmado(txDe(ref1, 'APPROVED')))
  check('pagos', 'el webhook aprobado responde 200', ok1.status === 200, `status ${ok1.status}`)
  let p = await plan()
  check('pagos', 'el plan queda ACTIVO', p.status === 'ACTIVE', p.status)
  check(
    'pagos',
    'los 15 días de prueba NO se pierden: 15 + 30 = 45 días',
    p.daysLeft >= 44 && p.daysLeft <= 46,
    `${p.daysLeft} días`,
  )

  // Reenviar el mismo evento no suma otros 30 días (Wompi reintenta a veces)
  await S.post('/api/wompi/eventos', eventoFirmado(txDe(ref1, 'APPROVED')))
  check('pagos', 'reenviar el mismo evento no duplica los 30 días', (await dias()) === p.daysLeft, `${await dias()}`)

  // ── SEGUNDO MES: SE SUMA SOBRE LO QUE QUEDA ──
  const co2 = await S.post('/api/plan/checkout')
  await S.post('/api/wompi/eventos', eventoFirmado(txDe(co2.data.reference, 'APPROVED')))
  p = await plan()
  check('pagos', 'el segundo pago suma 30 días más: ~75', p.daysLeft >= 74 && p.daysLeft <= 76, `${p.daysLeft} días`)

  // ── PAGO RECHAZADO: NO PASA NADA ──
  const co3 = await S.post('/api/plan/checkout')
  await S.post('/api/wompi/eventos', eventoFirmado(txDe(co3.data.reference, 'DECLINED')))
  const trasRechazo = await S.get(`/api/plan/checkout?ref=${co3.data.reference}`)
  check('pagos', 'el pago rechazado queda DECLINED', trasRechazo.data.status === 'DECLINED', trasRechazo.data.status)
  const diasTrasRechazo = await dias()
  check('pagos', 'y no movió la vigencia (~75)', diasTrasRechazo >= 74 && diasTrasRechazo <= 76, `${diasTrasRechazo}`)

  // ── RESPALDO SIN WEBHOOK: LA APP LE PREGUNTA A WOMPI ──
  const co4 = await S.post('/api/plan/checkout')
  await fetch(`${WOMPI_FALSO}/registrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txDe(co4.data.reference, 'APPROVED')),
  })
  const respaldo = await S.get(`/api/plan/checkout?ref=${co4.data.reference}`)
  check('pagos', 'sin webhook, la consulta de respaldo aprueba el pago', respaldo.data.status === 'APPROVED', respaldo.data.status)
  p = await plan()
  check('pagos', 'y suma sus 30 días: ~105', p.daysLeft >= 104 && p.daysLeft <= 106, `${p.daysLeft} días`)
  // el webhook tardío del mismo pago ya no suma nada
  await S.post('/api/wompi/eventos', eventoFirmado(txDe(co4.data.reference, 'APPROVED')))
  check('pagos', 'el webhook tardío del mismo pago no duplica', (await dias()) === p.daysLeft, `${await dias()}`)

  // ── VOLVER DEL CHECKOUT: LA APP CONFIRMA Y AGRADECE ──
  await page.goto(BASE + `/app?pago=${encodeURIComponent(co4.data.reference)}`)
  let agradecio = false
  for (let i = 0; i < 12 && !agradecio; i++) {
    await page.waitForTimeout(700)
    agradecio = (await page.textContent('body')).includes('Pago recibido')
  }
  check('pagos', 'al volver del checkout aparece "Pago recibido — tu plan quedó activo"', agradecio)

  // ── EL SUPER ADMIN VE LOS PAGOS ──
  const admin = await loginOnly(browser, 'mar_u_79@hotmail.com', 'VentoryBB2026')
  const lista = await admin.get('/api/admin/businesses')
  const fila = lista.status === 200 ? lista.data.businesses.find((b) => b.name === `QA Pagos ${t}`) : null
  check('pagos', 'el super admin ve el negocio con sus pagos', !!fila, `status ${lista.status}`)
  if (fila) {
    check('pagos', 'cuenta 3 pagos aprobados por $149.700', fila.pagos.cantidad === 3 && fila.pagos.total === 149700, JSON.stringify(fila.pagos))
    check('pagos', 'el plan del negocio figura pagado y vigente', fila.plan.status === 'ACTIVE' && !!fila.plan.paidUntil && !fila.plan.blocked)
  }
  await admin.ctx.close()

  check('pagos', 'ningún error de JavaScript', errores.length === 0, errores.join(' | ').slice(0, 200))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
