// PRUEBA 15: PIN de acceso rápido (asignarlo en Usuarios y entrar por /pin-login)
//
// Antes no había forma de asignar el PIN de 4 dígitos desde la interfaz: el
// backend existía (POST /api/users/set-pin) pero nada lo llamaba. Esta
// prueba cubre el camino completo: el admin ve el identificador del negocio
// en Ajustes, le asigna un PIN a un cajero desde Usuarios (con el teclado
// numérico propio, no un input nativo), y ese cajero entra por /pin-login.
// También cubre PIN incorrecto y quitar el PIN ya asignado.

const { check, summary, newBrowser, registerAndLogin, BASE, usarTecladoNumerico } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Pin ${t}`,
    name: 'Dueña Pin',
    email: `qa_pin_${t}@test.com`,
    password: 'VentoryQA2026',
  })

  const page = S.page
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(BASE + '/app')
  await page.waitForTimeout(2000)
  if (await page.locator('text=Omitir por ahora').count()) {
    await page.locator('text=Omitir por ahora').first().click()
    await page.waitForTimeout(500)
  }

  // ── EL IDENTIFICADOR DEL NEGOCIO SE VE EN AJUSTES ──
  await page.locator('button:has-text("Ajustes")').first().click()
  await page.waitForTimeout(800)
  const ajustesTxt = await page.locator('body').innerText()
  check('pin', 'Ajustes muestra el identificador del negocio', ajustesTxt.includes('Identificador del negocio'))

  const slug = (await S.get('/api/settings')).data.settings.slug
  const slugMostrado = await page.locator('label:has-text("Identificador del negocio") + input').inputValue()
  check('pin', 'el identificador que se ve es el slug real del negocio', !!slug && slugMostrado === slug, `${slug} vs ${slugMostrado}`)

  await page.locator('button:has-text("✕")').last().click()
  await page.waitForTimeout(400)

  // ── CREAR UN CAJERO Y ASIGNARLE PIN DESDE USUARIOS ──
  await page.locator('button:has-text("Ajustes")').first().click()
  await page.waitForTimeout(600)
  await page.locator('button:has-text("Gestión de usuarios")').first().click()
  await page.waitForTimeout(700)
  await page.locator('button:has-text("Nuevo usuario")').first().click()
  await page.waitForTimeout(600)

  await page.fill('input[placeholder="Nombre del usuario"]', `Cajero Pin ${t}`)
  await page.fill('input[placeholder="usuario@ventory.com"]', `cajero_pin_${t}@test.com`)
  await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'ClaveCajero99')

  await page.locator('label:has-text("PIN de acceso rápido") + div > button').first().click()
  await page.waitForTimeout(400)
  await usarTecladoNumerico(page, '4821')
  await page.waitForTimeout(400)

  await page.locator('button:has-text("Guardar usuario")').first().click()
  await page.waitForTimeout(1200)

  const trasCrear = await page.locator('body').innerText()
  // la insignia es un <span>PIN</span> exacto — se cuenta así porque el nombre
  // del negocio de esta prueba ("QA Pin …") también contiene "pin" en mayúsculas
  const insigniaPin = page.locator('span', { hasText: /^PIN$/ })
  check('pin', 'el cajero nuevo aparece con la insignia PIN en la lista', trasCrear.includes(`Cajero Pin ${t}`) && (await insigniaPin.count()) === 1)

  // ── ENTRAR POR /pin-login CON ESE PIN ──
  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.goto(BASE + '/pin-login')
  await page2.waitForTimeout(600)
  await page2.fill('input[placeholder="mi-negocio"]', slug)
  await page2.locator('button:has-text("Continuar")').click()
  await page2.waitForTimeout(600)

  // PIN incorrecto primero: no debe dejar entrar
  for (const d of ['1', '1', '1', '1']) {
    await page2.locator('button', { hasText: new RegExp(`^${d}$`) }).click()
  }
  await page2.locator('button:has-text("Entrar")').click()
  await page2.waitForTimeout(1000)
  check('pin', 'un PIN incorrecto no deja entrar', page2.url().includes('/pin-login'))
  check('pin', 'un PIN incorrecto muestra el error', (await page2.locator('body').innerText()).includes('PIN incorrecto'))

  // Ahora el PIN correcto
  for (const d of ['4', '8', '2', '1']) {
    await page2.locator('button', { hasText: new RegExp(`^${d}$`) }).click()
  }
  await page2.locator('button:has-text("Entrar")').click()
  await page2.waitForURL('**/app', { timeout: 10000 }).catch(() => {})
  check('pin', 'el PIN correcto entra directo a /app (no al panel viejo)', page2.url().includes('/app'), page2.url())

  await ctx2.close()

  // ── QUITAR EL PIN DESDE USUARIOS ──
  // el admin (dueña) se creó primero y no tiene botón "Editar" al final de la
  // lista con PIN: el cajero es el único con PIN, así que su fila es la última
  await page.locator('button:has-text("Editar")').last().click()
  await page.waitForTimeout(600)
  await page.locator('label:has-text("PIN de acceso rápido") + div button:has-text("Quitar")').click()
  await page.waitForTimeout(800)
  await page.locator('button:has-text("Cancelar")').first().click()
  await page.waitForTimeout(600)
  const trasQuitar = await page.locator('body').innerText()
  check(
    'pin',
    'quitar el PIN saca la insignia PIN de la lista',
    trasQuitar.includes(`Cajero Pin ${t}`) && (await page.locator('span', { hasText: /^PIN$/ }).count()) === 0,
  )

  check('pin', 'ningún error de JavaScript', errores.length === 0, errores.join(' | ').slice(0, 200))

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
