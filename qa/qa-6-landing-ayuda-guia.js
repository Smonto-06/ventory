// PRUEBA 6: páginas públicas (landing y centro de ayuda) y guía de primeros pasos
const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

// La página pública se recorre despacio para que las imágenes con carga
// diferida entren en pantalla, igual que haría una persona.
async function recorrer(page) {
  for (let i = 0; i < 14; i++) {
    await page.evaluate((n) => window.scrollTo(0, n * window.innerHeight * 0.8), i)
    await page.waitForTimeout(320)
  }
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
}

async function anchoDesbordado(page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
}

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)

  // ── LANDING (escritorio) ──
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  let page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })

  const texto = await page.textContent('body')
  check('landing', 'la página pública abre sin iniciar sesión', page.url() === BASE + '/', page.url())
  check('landing', 'muestra el precio del plan', /59\.900/.test(texto))
  check('landing', 'muestra el correo de soporte', texto.includes('ventorypos@gmail.com'))
  check('landing', 'ofrece la prueba gratis', /prueba gratis/i.test(texto))
  for (const href of ['/register', '/login', '/ayuda', '/terminos', '/privacidad']) {
    check('landing', `enlaza a ${href}`, (await page.locator(`a[href="${href}"]`).count()) > 0)
  }

  await recorrer(page)
  const rotas = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => !(i.complete && i.naturalWidth > 0))
      .map((i) => i.currentSrc || i.src),
  )
  check('landing', 'todas las capturas cargan', rotas.length === 0, rotas.join(' | '))
  const marco = await page.evaluate(() => {
    const img = Array.from(document.images).find((i) => (i.currentSrc || i.src).includes('movil'))
    return img ? Math.round(img.getBoundingClientRect().width) : -1
  })
  check('landing', 'la captura del celular se ve (ancho > 0)', marco > 100, `ancho ${marco}`)

  let o = await anchoDesbordado(page)
  check('landing', 'sin desbordamiento horizontal en escritorio', o.scroll <= o.client + 1, `${o.scroll}/${o.client}`)
  check('landing', 'ningún error de JavaScript', errores.length === 0, errores.join(' | '))
  await ctx.close()

  // ── LANDING (celular) ──
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await recorrer(page)
  o = await anchoDesbordado(page)
  check('landing', 'sin desbordamiento horizontal en celular', o.scroll <= o.client + 1, `${o.scroll}/${o.client}`)
  await ctx.close()

  // ── CENTRO DE AYUDA ──
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  page = await ctx.newPage()
  const erroresAyuda = []
  page.on('pageerror', (e) => erroresAyuda.push(String(e)))
  await page.goto(BASE + '/ayuda', { waitUntil: 'networkidle' })
  const ta = await page.textContent('body')
  check('ayuda', 'abre sin iniciar sesión', page.url().endsWith('/ayuda'), page.url())
  const preguntas = await page.locator('details').count()
  check('ayuda', 'tiene al menos 15 preguntas frecuentes', preguntas >= 15, `${preguntas}`)
  check('ayuda', 'incluye el correo de soporte', ta.includes('ventorypos@gmail.com'))
  await page.locator('details').first().locator('summary').click()
  await page.waitForTimeout(200)
  check('ayuda', 'las respuestas se despliegan', (await page.locator('details[open]').count()) >= 1)
  o = await anchoDesbordado(page)
  check('ayuda', 'sin desbordamiento horizontal en escritorio', o.scroll <= o.client + 1, `${o.scroll}/${o.client}`)
  check('ayuda', 'ningún error de JavaScript', erroresAyuda.length === 0, erroresAyuda.join(' | '))
  await ctx.close()

  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page = await ctx.newPage()
  await page.goto(BASE + '/ayuda', { waitUntil: 'networkidle' })
  o = await anchoDesbordado(page)
  check('ayuda', 'sin desbordamiento horizontal en celular', o.scroll <= o.client + 1, `${o.scroll}/${o.client}`)
  await ctx.close()

  // ── GUÍA DE PRIMEROS PASOS (cuenta nueva) ──
  const S = await registerAndLogin(browser, {
    businessName: `QA Guia ${t}`,
    name: 'Cuenta Nueva',
    email: `qa_guia_${t}@test.com`,
    password: 'VentoryQA2026',
  })
  const p = S.page
  const erroresPanel = []
  p.on('pageerror', (e) => erroresPanel.push(String(e)))
  await p.waitForTimeout(2000)
  // el modal de apertura de caja aparece solo al entrar
  if (await p.locator('text=Omitir por ahora').count()) {
    await p.locator('text=Omitir por ahora').first().click()
    await p.waitForTimeout(500)
  }

  const tp = await p.textContent('body')
  check('guía', 'aparece en un negocio recién creado', tp.includes('Primeros pasos con Ventory'))
  check('guía', 'muestra el progreso real', /0 de 4 completados/.test(tp), (tp.match(/\d de \d completados/) || [''])[0])
  for (const paso of ['Carga tus productos', 'Completa los datos de tu factura', 'Abre la caja del día', 'Haz tu primera venta']) {
    check('guía', `incluye el paso "${paso}"`, tp.includes(paso))
  }
  check('guía', 'el menú lateral tiene acceso a Ayuda', (await p.locator('nav button', { hasText: 'Ayuda' }).count()) > 0)

  await p.locator('text=Ir a Productos →').first().click()
  await p.waitForTimeout(1000)
  check('guía', 'el botón del paso lleva a Productos', (await p.textContent('body')).includes('Nuevo producto'))

  // al crear un producto el primer paso queda marcado
  await S.post('/api/products', { name: `Producto guia ${t}`, price: 5000, cost: 3000, initialStock: 5 })
  await p.goto(BASE + '/app')
  await p.waitForTimeout(2500)
  if (await p.locator('text=Omitir por ahora').count()) {
    await p.locator('text=Omitir por ahora').first().click()
    await p.waitForTimeout(500)
  }
  check('guía', 'el progreso avanza al completar un paso', /1 de 4 completados/.test(await p.textContent('body')))

  await p.locator('text=Ocultar guía').first().click()
  await p.waitForTimeout(400)
  check('guía', 'se puede ocultar', !(await p.textContent('body')).includes('Primeros pasos con Ventory'))
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  check('guía', 'sigue oculta después de recargar', !(await p.textContent('body')).includes('Primeros pasos con Ventory'))
  check('guía', 'ningún error de JavaScript', erroresPanel.length === 0, erroresPanel.join(' | '))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
