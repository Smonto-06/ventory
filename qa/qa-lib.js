// Utilidades compartidas para la batería de pruebas
const { chromium } = require('playwright')
const BASE = 'http://localhost:3100'

const results = []
function check(area, name, ok, detail = '') {
  results.push({ area, name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} [${area}] ${name}${ok ? '' : '  → ' + detail}`)
}
function summary() {
  const fail = results.filter(r => !r.ok)
  console.log(`\n${'='.repeat(70)}`)
  console.log(`TOTAL: ${results.length} pruebas · ${results.length - fail.length} OK · ${fail.length} FALLAS`)
  if (fail.length) {
    console.log('\nFALLAS:')
    fail.forEach(f => console.log(`  ✗ [${f.area}] ${f.name} → ${f.detail}`))
  }
  return fail.length
}

async function newBrowser() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
}

async function registerAndLogin(browser, { businessName, name, email, password }) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(BASE + '/register')
  const inputs = page.locator('input')
  await inputs.nth(0).fill(businessName)
  await inputs.nth(1).fill(name)
  await inputs.nth(2).fill(email)
  await inputs.nth(3).fill(password)
  await inputs.nth(4).fill(password)
  await page.locator('input[type=checkbox]').check()
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/login**', { timeout: 20000 })
  return loginExisting(ctx, page, email, password)
}

async function loginExisting(ctx, page, email, password) {
  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[placeholder="Contraseña"]', password)
  await page.click('button[type=submit]')
  await page.waitForURL('**/app', { timeout: 20000 })
  await page.waitForTimeout(800)
  // helper de API dentro de esta sesión
  const api = async (url, opts) =>
    page.evaluate(async ([u, o]) => {
      const r = await fetch(u, o ? { ...o, headers: { 'Content-Type': 'application/json' } } : undefined)
      let data = null
      try { data = await r.json() } catch { data = null }
      return { status: r.status, data }
    }, [url, opts ?? null])
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body ?? {}) })
  const patch = (url, body) => api(url, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
  const put = (url, body) => api(url, { method: 'PUT', body: JSON.stringify(body ?? {}) })
  const del = (url, body) => api(url, { method: 'DELETE', body: JSON.stringify(body ?? {}) })
  return { ctx, page, get: api, post, patch, put, del }
}

async function loginOnly(browser, email, password) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  return loginExisting(ctx, page, email, password)
}

module.exports = { BASE, check, summary, newBrowser, registerAndLogin, loginOnly, results }
