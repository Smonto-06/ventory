/**
 * Pasarela Wompi: firma de integridad del checkout, verificación de la firma
 * de los webhooks y reglas de vigencia del plan (planInfo con paidUntil).
 * Todo es criptografía y fechas puras — sin red ni base de datos.
 */

import { createHash } from 'crypto'

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex')

const ENV = {
  WOMPI_PUBLIC_KEY: 'pub_test_abc123',
  WOMPI_PRIVATE_KEY: 'prv_test_def456',
  WOMPI_INTEGRITY_SECRET: 'test_integrity_secreto',
  WOMPI_EVENTS_SECRET: 'test_events_secreto',
}

beforeEach(() => {
  Object.assign(process.env, ENV)
  jest.resetModules()
})

afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k]
})

const wompi = () => require('../lib/wompi') as typeof import('../lib/wompi')

describe('configuración', () => {
  it('configurado solo con las 4 llaves presentes', () => {
    expect(wompi().wompiConfigurado()).toBe(true)
    delete process.env.WOMPI_EVENTS_SECRET
    expect(wompi().wompiConfigurado()).toBe(false)
  })

  it('detecta el modo pruebas por el prefijo pub_test_', () => {
    expect(wompi().wompiEnPruebas()).toBe(true)
    expect(wompi().wompiApiBase()).toBe('https://sandbox.wompi.co/v1')
    process.env.WOMPI_PUBLIC_KEY = 'pub_prod_xyz'
    expect(wompi().wompiEnPruebas()).toBe(false)
    expect(wompi().wompiApiBase()).toBe('https://production.wompi.co/v1')
  })

  it('el precio del plan es $49.900 → 4.990.000 centavos', () => {
    expect(wompi().PLAN_PRECIO_COP).toBe(49900)
    expect(wompi().PLAN_CENTAVOS).toBe(4990000)
  })
})

describe('firma de integridad del checkout', () => {
  it('es sha256(referencia + monto + moneda + secreto)', () => {
    const esperada = sha256(`VEN-XYZ-14990000COP${ENV.WOMPI_INTEGRITY_SECRET}`)
    expect(wompi().firmaIntegridad('VEN-XYZ-1', 4990000)).toBe(esperada)
  })

  it('la URL del checkout lleva llave pública, monto, referencia y firma', () => {
    const url = new URL(
      wompi().urlCheckout({ reference: 'VEN-ABC-9', amountInCents: 4990000, redirectUrl: 'https://ventory-ten.vercel.app/app?pago=VEN-ABC-9' }),
    )
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/')
    expect(url.searchParams.get('public-key')).toBe(ENV.WOMPI_PUBLIC_KEY)
    expect(url.searchParams.get('amount-in-cents')).toBe('4990000')
    expect(url.searchParams.get('currency')).toBe('COP')
    expect(url.searchParams.get('reference')).toBe('VEN-ABC-9')
    expect(url.searchParams.get('signature:integrity')).toBe(wompi().firmaIntegridad('VEN-ABC-9', 4990000))
    expect(url.searchParams.get('redirect-url')).toContain('/app?pago=')
  })

  it('cambiar el monto cambia la firma (no se puede pagar menos)', () => {
    expect(wompi().firmaIntegridad('VEN-1', 4990000)).not.toBe(wompi().firmaIntegridad('VEN-1', 100))
  })
})

describe('verificación de eventos (webhook)', () => {
  const evento = (propiedades: Record<string, string | number>, secreto = ENV.WOMPI_EVENTS_SECRET) => {
    const timestamp = 1720000000
    const data = {
      transaction: {
        id: 'txn-123',
        status: 'APPROVED',
        reference: 'VEN-ABC-9',
        amount_in_cents: 4990000,
        currency: 'COP',
        ...propiedades,
      },
    }
    const props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
    const concatenado = props
      .map((p) => String(p.split('.').reduce((o: any, k) => o?.[k], data) ?? ''))
      .join('')
    return {
      event: 'transaction.updated',
      data,
      timestamp,
      signature: { properties: props, checksum: sha256(`${concatenado}${timestamp}${secreto}`) },
    }
  }

  it('acepta un evento con checksum correcto', () => {
    expect(wompi().eventoValido(evento({}) as any)).toBe(true)
  })

  it('rechaza un evento firmado con otro secreto', () => {
    expect(wompi().eventoValido(evento({}, 'secreto-equivocado') as any)).toBe(false)
  })

  it('rechaza un evento alterado después de firmado (monto cambiado)', () => {
    const e = evento({}) as any
    e.data.transaction.amount_in_cents = 100
    expect(wompi().eventoValido(e)).toBe(false)
  })

  it('rechaza eventos sin firma o sin timestamp', () => {
    const e = evento({}) as any
    expect(wompi().eventoValido({ ...e, signature: undefined })).toBe(false)
    expect(wompi().eventoValido({ ...e, timestamp: undefined })).toBe(false)
  })
})

describe('vigencia del plan con paidUntil', () => {
  const { planInfo } = require('../lib/plan') as typeof import('../lib/plan')
  const DIA = 86400000

  it('ACTIVE sin paidUntil = activación manual, nunca vence', () => {
    const p = planInfo({ status: 'ACTIVE', trialEndsAt: null, paidUntil: null })
    expect(p.blocked).toBe(false)
    expect(p.daysLeft).toBeNull()
  })

  it('ACTIVE con mensualidad vigente: días restantes y sin bloqueo', () => {
    const p = planInfo({ status: 'ACTIVE', trialEndsAt: null, paidUntil: new Date(Date.now() + 10 * DIA) })
    expect(p.blocked).toBe(false)
    expect(p.daysLeft).toBe(10)
  })

  it('ACTIVE con mensualidad vencida: bloquea', () => {
    const p = planInfo({ status: 'ACTIVE', trialEndsAt: null, paidUntil: new Date(Date.now() - DIA) })
    expect(p.blocked).toBe(true)
    expect(p.daysLeft).toBe(0)
  })

  it('la prueba sigue funcionando igual que antes', () => {
    const p = planInfo({ status: 'TRIAL', trialEndsAt: new Date(Date.now() + 5 * DIA) })
    expect(p.blocked).toBe(false)
    expect(p.daysLeft).toBe(5)
    expect(planInfo({ status: 'TRIAL', trialEndsAt: new Date(Date.now() - DIA) }).blocked).toBe(true)
  })
})
