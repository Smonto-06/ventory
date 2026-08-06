// PRUEBA 8: notificaciones automáticas (resumen diario y aviso de reposición)
//
// El envío real de correo se verifica con un servidor SMTP de mentira que
// levanta el propio script: así se comprueba que el correo sale, a quién va y
// qué dice, sin mandarle nada a nadie.

const { check, summary, newBrowser, registerAndLogin, BASE } = require('./qa-lib')

;(async () => {
  const browser = await newBrowser()
  const t = Date.now().toString(36)
  const S = await registerAndLogin(browser, {
    businessName: `QA Avisos ${t}`,
    name: 'Dueño Avisos',
    email: `qa_avisos_${t}@test.com`,
    password: 'VentoryQA2026',
  })

  const suc = await S.get('/api/branches')
  const branchId = suc.data.branches[0].id

  // ── AJUSTES ──
  const porDefecto = await S.get('/api/settings')
  check(
    'avisos',
    'el resumen diario viene apagado por defecto',
    porDefecto.data.settings.notifyDailySummary === false,
    `${porDefecto.data.settings.notifyDailySummary}`,
  )
  check(
    'avisos',
    'el aviso de reposición viene encendido por defecto',
    porDefecto.data.settings.notifyLowStock === true,
  )

  const guardado = await S.put('/api/settings', {
    notifyDailySummary: true,
    notifyLowStock: true,
    notifyEmail: `dueno_${t}@test.com`,
  })
  check('avisos', 'se pueden activar y elegir el correo destino', guardado.status === 200, `status ${guardado.status}`)
  check(
    'avisos',
    'los ajustes quedan guardados',
    guardado.data.settings.notifyDailySummary === true &&
      guardado.data.settings.notifyEmail === `dueno_${t}@test.com`,
  )

  const vacio = await S.put('/api/settings', { notifyEmail: '' })
  check(
    'avisos',
    'dejar el correo vacío significa "el del administrador"',
    vacio.data.settings.notifyEmail === null,
    `${vacio.data.settings.notifyEmail}`,
  )
  await S.put('/api/settings', { notifyEmail: `dueno_${t}@test.com` })

  // ── PERMISOS ──
  const sinSesion = await fetch(`${BASE}/api/cron/resumen-diario`, { redirect: 'manual' })
  check('avisos', 'el cron no responde sin el secreto', sinSesion.status === 401, `status ${sinSesion.status}`)
  const secretoMalo = await fetch(`${BASE}/api/cron/resumen-diario`, {
    headers: { authorization: 'Bearer no-es-el-secreto' },
    redirect: 'manual',
  })
  check('avisos', 'el cron rechaza un secreto equivocado', secretoMalo.status === 401, `status ${secretoMalo.status}`)

  // ── CONTENIDO DEL RESUMEN ──
  // Se monta un día real: producto, caja, venta y un producto agotado.
  const prod = await S.post('/api/products', {
    name: `Producto avisos ${t}`,
    price: 20000,
    cost: 8000,
    branchId,
    initialStock: 10,
    minStock: 2,
  })
  const agotado = await S.post('/api/products', {
    name: `Agotado ${t}`,
    price: 5000,
    cost: 2000,
    branchId,
    initialStock: 0,
    minStock: 1,
  })
  const caja = await S.post('/api/cash-registers/open', { branchId, openingBalance: 100000 })
  const sid = caja.data?.session?.id ?? caja.data?.cashSession?.id
  await S.post('/api/sales', {
    cashSessionId: sid,
    items: [{ productId: prod.data.product.id, quantity: 3, unitPrice: 20000 }],
    paymentMethod: 'CASH',
    payments: { cashActive: true, cashReceived: 60000, card: 0, transfer: 0 },
  })
  await S.post('/api/sales', {
    cashSessionId: sid,
    items: [{ productId: prod.data.product.id, quantity: 1, unitPrice: 20000 }],
    paymentMethod: 'CARD',
    payments: { cashActive: false, cashReceived: 0, card: 20000, transfer: 0 },
  })

  const resumen = await S.get('/api/notifications/preview')
  if (resumen.status === 200) {
    const r = resumen.data.resumen
    check('avisos', 'el resumen cuenta las ventas del día', r.ventas.total === 80000, `${r.ventas.total}`)
    check('avisos', 'separa efectivo y tarjeta', r.porMetodo.efectivo === 60000 && r.porMetodo.tarjeta === 20000)
    check('avisos', 'calcula la utilidad neta', r.utilidad.neta === 80000 - 32000, `${r.utilidad.neta}`)
    check(
      'avisos',
      'el saldo esperado solo cuenta el efectivo',
      r.caja.esperado === 100000 + 60000,
      `${r.caja.esperado}`,
    )
    check(
      'avisos',
      'lista los productos por reponer',
      r.agotados.some((a) => a.nombre === `Agotado ${t}`),
      r.agotados.map((a) => a.nombre).join(','),
    )
    check(
      'avisos',
      'no incluye productos con stock suficiente',
      !r.agotados.some((a) => a.nombre === `Producto avisos ${t}`),
    )
    check('avisos', 'incluye los más vendidos', r.topProductos[0]?.nombre === `Producto avisos ${t}`)
  } else {
    check('avisos', 'la vista previa del resumen responde', false, `status ${resumen.status}`)
  }

  // ── ENVÍO REAL ──
  // Si el servidor tiene correo configurado (en las pruebas, un SMTP falso en
  // el puerto 2525), se comprueba que el correo sale de verdad y qué dice.
  const prueba = await S.post('/api/notifications/test', {})
  if (prueba.status === 503) {
    console.log('  (envío de correo no configurado en el servidor: se omite esa parte)')
  } else {
    check('avisos', 'el envío de prueba responde bien', prueba.status === 200, `status ${prueba.status}`)
    check('avisos', 'lo manda al correo configurado', prueba.data?.destino === `dueno_${t}@test.com`, `${prueba.data?.destino}`)

    const buzon = process.env.VENTORY_BUZON
    if (buzon) {
      const fs = require('fs')
      await new Promise((r) => setTimeout(r, 1200))
      const correos = fs
        .readFileSync(buzon, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l).cuerpo)
      const ultimo = correos[correos.length - 1] ?? ''
      const decodificado = ultimo.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) =>
        Buffer.from(h, 'hex').toString('utf8'),
      )
      check('avisos/correo', 'el correo llegó al servidor de salida', correos.length > 0)
      check('avisos/correo', 'el asunto trae el total del día', /80\.000/.test(decodificado), 'sin el total')
      check('avisos/correo', 'el cuerpo nombra el negocio', decodificado.includes(`QA Avisos ${t}`))
      check('avisos/correo', 'incluye lo que hay que reponer', decodificado.includes(`Agotado ${t}`))
      check(
        'avisos/correo',
        'explica cómo desactivarlo',
        /Notificaciones/.test(decodificado) && /desactivarlo|Ajustes/.test(decodificado),
      )
    }
  }

  // ── EL CRON COMPLETO ──
  // Se llama igual que lo haría Vercel cada noche.
  const secreto = process.env.CRON_SECRET_PRUEBA
  if (secreto) {
    const antes = require('fs').existsSync(process.env.VENTORY_BUZON ?? '')
      ? require('fs').readFileSync(process.env.VENTORY_BUZON, 'utf8').split('\n').filter(Boolean).length
      : 0
    const corrida = await fetch(`${BASE}/api/cron/resumen-diario`, {
      headers: { authorization: `Bearer ${secreto}` },
    })
    const datos = await corrida.json()
    check('avisos/cron', 'el cron responde con el secreto correcto', corrida.status === 200, `status ${corrida.status}`)
    check('avisos/cron', 'incluye a este negocio en el envío', (datos.enviados ?? 0) >= 1, JSON.stringify(datos))
    check('avisos/cron', 'ningún envío falló', (datos.fallos ?? 0) === 0, JSON.stringify(datos))
    if (process.env.VENTORY_BUZON) {
      await new Promise((r) => setTimeout(r, 1200))
      const despues = require('fs').readFileSync(process.env.VENTORY_BUZON, 'utf8').split('\n').filter(Boolean).length
      check('avisos/cron', 'salieron correos nuevos', despues > antes, `${antes} → ${despues}`)
    }
  }

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
  await page.locator('nav button', { hasText: 'Ajustes' }).first().click()
  await page.waitForTimeout(1200)
  const cuerpo = await page.textContent('body')
  check('avisos/ui', 'Ajustes tiene la sección Notificaciones', cuerpo.includes('Notificaciones'))
  check('avisos/ui', 'ofrece el resumen del día por correo', cuerpo.includes('Resumen del día por correo'))
  check('avisos/ui', 'ofrece el aviso de reposición', cuerpo.includes('Avisar qué hay que reponer'))
  check('avisos/ui', 'ofrece enviarse una prueba', cuerpo.includes('Enviarme una prueba ahora'))
  check('avisos/ui', 'ningún error de JavaScript', errores.length === 0, errores.join(' | '))

  // ── REENVÍO DEL CORREO DE VERIFICACIÓN ──
  // Si el correo del registro se pierde (spam, filtro), el usuario no puede
  // quedar atascado: el login ofrece reenviarlo, con token nuevo, límite de
  // uno por minuto y respuesta genérica que no revela cuentas ajenas.
  if (process.env.VENTORY_BUZON) {
    const fs = require('fs')
    const correoR = `reenvio_${t}@test.com`
    const enlacesDe = (email) => {
      if (!fs.existsSync(process.env.VENTORY_BUZON)) return []
      const out = []
      for (const linea of fs.readFileSync(process.env.VENTORY_BUZON, 'utf8').split('\n').filter(Boolean)) {
        const texto = JSON.parse(linea).cuerpo
          .replace(/=\r\n/g, '')
          .replace(/=([0-9A-F]{2})/g, (_, h) => Buffer.from(h, 'hex').toString('utf8'))
        if (!texto.includes(email)) continue
        const m = texto.match(/https?:\/\/[^\s"'<>]*\/verify\?token=[A-Za-z0-9]+/)
        if (m) out.push(m[0])
      }
      return out
    }
    const reg = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reenvio', email: correoR, password: 'ClaveSegura99', businessName: `Reenvio ${t}` }),
    })
    check('reenvío', 'el registro queda pendiente de verificar', reg.status === 201)

    const ctxR = await browser.newContext()
    const pageR = await ctxR.newPage()
    await pageR.goto(BASE + '/login')
    await pageR.fill('input[type=email]', correoR)
    await pageR.fill('input[placeholder="Contraseña"]', 'ClaveSegura99')
    await pageR.click('button[type=submit]')
    await pageR.waitForTimeout(2500)
    check('reenvío', 'el login sin verificar pide confirmar el correo', (await pageR.textContent('body')).includes('Confirma tu correo'))
    const btnR = pageR.locator('button:has-text("Reenviar correo de verificación")')
    check('reenvío', 'y ofrece reenviarlo ahí mismo', (await btnR.count()) > 0)

    const antesR = enlacesDe(correoR)
    await btnR.first().click()
    await pageR.waitForTimeout(2500)
    const despuesR = enlacesDe(correoR)
    check('reenvío', 'el reenvío manda un correo nuevo', despuesR.length === antesR.length + 1, `${antesR.length} → ${despuesR.length}`)
    check('reenvío', 'con un token distinto al original', despuesR[despuesR.length - 1] !== antesR[antesR.length - 1])

    await fetch(BASE + '/api/auth/verify/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correoR }),
    })
    await new Promise((r) => setTimeout(r, 800))
    check('reenvío', 'pedir otro de inmediato no manda nada (límite 1/min)', enlacesDe(correoR).length === despuesR.length)

    const ajeno = await fetch(BASE + '/api/auth/verify/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `noexiste_${t}@test.com` }),
    })
    check('reenvío', 'un correo ajeno recibe la misma respuesta (no revela cuentas)', ajeno.status === 200)

    await pageR.goto(despuesR[despuesR.length - 1])
    await pageR.waitForTimeout(3000)
    await pageR.goto(BASE + '/login')
    await pageR.fill('input[type=email]', correoR)
    await pageR.fill('input[placeholder="Contraseña"]', 'ClaveSegura99')
    await pageR.click('button[type=submit]')
    await pageR.waitForURL('**/app', { timeout: 20000 }).catch(() => {})
    check('reenvío', 'con el enlace reenviado, la cuenta entra', pageR.url().includes('/app'))

    const viejo = await fetch(BASE + '/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: (antesR[antesR.length - 1] ?? 'token=x').split('token=')[1] }),
    })
    check('reenvío', 'el enlace viejo quedó invalidado', viejo.status === 400)
    await ctxR.close()
  }

  await S.ctx.close()
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
