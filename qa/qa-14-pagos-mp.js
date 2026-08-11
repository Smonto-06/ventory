// PRUEBA 14: pasarela Mercado Pago (la interina, mientras llega Wompi)
//
// Mismo contrato que Wompi: el dueño paga $59.900 y la cuenta se activa sola
// 30 días, sin duplicar jamás. La seguridad aquí es distinta: el webhook NO
// confía en su cuerpo — consulta el pago a la API de Mercado Pago con nuestro
// token y solo aprueba si allá figura aprobado con la referencia y el monto
// exactos. Un webhook falsificado no puede activar nada.
//
// Requiere el servidor con SOLO el token de Mercado Pago (sin llaves Wompi,
// que tendrían prioridad) y el Mercado Pago de mentira:
//   node qa/mercadopago-falso.js &
//   MP_ACCESS_TOKEN=TEST-qa MP_API_BASE=http://127.0.0.1:2527 node server.js

const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

const MP_FALSO = process.env.MP_FALSO || 'http://127.0.0.1:2527'

const registrarPago = (pago) =>
  fetch(`${MP_FALSO}/registrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pago),
  })

const pagoMp = (id, reference, status, extra = {}) => ({
  id,
  status,
  external_reference: reference,
  transaction_amount: 59900,
  currency_id: 'COP',
  payment_method_id: 'pse',
  date_approved: status === 'approved' ? new Date().toISOString() : null,
  ...extra,
})

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA MPago ${t}`,
    name: 'Dueña MP',
    email: `qa_mp_${t}@test.com`,
    password: 'VentoryQA2026',
  })
  const page = S.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))

  const dias = async () => (await S.get('/api/settings')).data.settings.plan.daysLeft
  const plan = async () => (await S.get('/api/settings')).data.settings.plan

  // ── LA PASARELA ACTIVA ES MERCADO PAGO ──
  const ajustes = (await S.get('/api/settings')).data.settings
  check('mpago', 'el pago en línea está habilitado', ajustes.pagoEnLinea === true)
  check('mpago', 'y la pasarela activa es Mercado Pago', ajustes.pasarela === 'mercadopago', ajustes.pasarela)

  // ── LA INTERFAZ: EL BOTÓN LLEVA AL CHECKOUT DE MERCADO PAGO ──
  await page.goto(BASE + '/app')
  await page.waitForTimeout(3000)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }
  const btnPagar = page.locator('button:has-text("Pagar mi plan")').first()
  check('mpago', 'el banner de prueba trae el botón "Pagar mi plan"', (await btnPagar.count()) > 0)
  await btnPagar.click()
  await page.waitForURL('**/co/**', { timeout: 15000 }).catch(() => {})
  const enCheckout = page.url().includes('/co/')
  check('mpago', 'el botón lleva al checkout de Mercado Pago', enCheckout, page.url())
  if (enCheckout) {
    check('mpago', 'el checkout recibe la referencia VEN-…', /^VEN-/.test((await page.textContent('#referencia')).trim()))
    check('mpago', 'y el monto de $59.900 (en pesos, no centavos)', (await page.textContent('#monto')).trim() === '59900')
  }
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2000)

  // ── CREAR EL CHECKOUT POR API ──
  const co = await S.post('/api/plan/checkout')
  check('mpago', 'el checkout se crea (201) vía Mercado Pago', co.status === 201 && co.data.gateway === 'mercadopago', JSON.stringify(co.data))
  check('mpago', 'en modo pruebas (token TEST-)', co.data.sandbox === true)
  const ref1 = co.data.reference

  // ── UN WEBHOOK FALSIFICADO NO ACTIVA NADA ──
  // El atacante inventa un id de pago que no existe en Mercado Pago
  const forjado = await S.post('/api/mercadopago/eventos', { type: 'payment', data: { id: 'pago-inventado-999' } })
  check('mpago', 'webhook con pago inexistente: se ignora sin error', forjado.status === 200, `status ${forjado.status}`)
  check('mpago', 'y el plan sigue en prueba', (await plan()).status === 'TRIAL')

  // El atacante logra un pago real… pero por otro monto
  await registrarPago(pagoMp('pago-barato', ref1, 'approved', { transaction_amount: 100 }))
  const barato = await S.post('/api/mercadopago/eventos', { type: 'payment', data: { id: 'pago-barato' } })
  check('mpago', 'un pago aprobado por $100 se rechaza (422): el monto no coincide', barato.status === 422, `status ${barato.status}`)
  check('mpago', 'y el plan sigue en prueba', (await plan()).status === 'TRIAL')

  // ── PAGO APROBADO DE VERDAD: LA CUENTA SE ACTIVA SOLA ──
  await registrarPago(pagoMp('pago-1', ref1, 'approved'))
  const ok1 = await S.post('/api/mercadopago/eventos', { type: 'payment', data: { id: 'pago-1' } })
  check('mpago', 'el webhook del pago aprobado responde 200', ok1.status === 200, `status ${ok1.status}`)
  let p = await plan()
  check('mpago', 'el plan queda ACTIVO', p.status === 'ACTIVE', p.status)
  check('mpago', 'los 15 días de prueba no se pierden: 15 + 30 = 45', p.daysLeft >= 44 && p.daysLeft <= 46, `${p.daysLeft} días`)

  // Mercado Pago reenvía notificaciones: no debe duplicar
  await S.post('/api/mercadopago/eventos', { type: 'payment', data: { id: 'pago-1' } })
  check('mpago', 'la notificación repetida no duplica los 30 días', (await dias()) === p.daysLeft, `${await dias()}`)

  // ── SEGUNDO MES (notificación por query, estilo viejo de MP) ──
  const co2 = await S.post('/api/plan/checkout')
  await registrarPago(pagoMp('pago-2', co2.data.reference, 'approved'))
  const porQuery = await S.post('/api/mercadopago/eventos?topic=payment&id=pago-2')
  check('mpago', 'la notificación por query (formato viejo) también funciona', porQuery.status === 200, `status ${porQuery.status}`)
  p = await plan()
  check('mpago', 'el segundo pago suma sobre lo restante: ~75', p.daysLeft >= 74 && p.daysLeft <= 76, `${p.daysLeft} días`)

  // ── PAGO RECHAZADO: NO PASA NADA ──
  const co3 = await S.post('/api/plan/checkout')
  await registrarPago(pagoMp('pago-3', co3.data.reference, 'rejected'))
  await S.post('/api/mercadopago/eventos', { type: 'payment', data: { id: 'pago-3' } })
  const rechazado = await S.get(`/api/plan/checkout?ref=${co3.data.reference}`)
  check('mpago', 'el pago rechazado queda DECLINED', rechazado.data.status === 'DECLINED', rechazado.data.status)
  const d3 = await dias()
  check('mpago', 'y no movió la vigencia (~75)', d3 >= 74 && d3 <= 76, `${d3}`)

  // ── RESPALDO SIN WEBHOOK: LA APP BUSCA EL PAGO POR REFERENCIA ──
  const co4 = await S.post('/api/plan/checkout')
  await registrarPago(pagoMp('pago-4', co4.data.reference, 'approved'))
  const respaldo = await S.get(`/api/plan/checkout?ref=${co4.data.reference}`)
  check('mpago', 'sin webhook, la búsqueda por referencia aprueba el pago', respaldo.data.status === 'APPROVED', respaldo.data.status)
  p = await plan()
  check('mpago', 'y suma sus 30 días: ~105', p.daysLeft >= 104 && p.daysLeft <= 106, `${p.daysLeft} días`)
  await S.post('/api/mercadopago/eventos', { type: 'payment', data: { id: 'pago-4' } })
  check('mpago', 'la notificación tardía del mismo pago no duplica', (await dias()) === p.daysLeft, `${await dias()}`)

  // ── VOLVER DEL CHECKOUT: LA APP CONFIRMA Y AGRADECE ──
  await page.goto(BASE + `/app?pago=${encodeURIComponent(co4.data.reference)}`)
  let agradecio = false
  for (let i = 0; i < 12 && !agradecio; i++) {
    await page.waitForTimeout(700)
    agradecio = (await page.textContent('body')).includes('Pago recibido')
  }
  check('mpago', 'al volver del checkout aparece "Pago recibido — tu plan quedó activo"', agradecio)

  check('mpago', 'ningún error de JavaScript', errores.length === 0, errores.join(' | ').slice(0, 200))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
