/**
 * Pasarela Mercado Pago (interina): configuración, mapeo de estados y la
 * regla de prioridad entre pasarelas. La creación de preferencias y las
 * consultas son llamadas de red — se prueban en qa-14 contra el falso.
 */

const LLAVES = ['MP_ACCESS_TOKEN', 'WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET']

beforeEach(() => {
  for (const k of LLAVES) delete process.env[k]
  jest.resetModules()
})

afterEach(() => {
  for (const k of LLAVES) delete process.env[k]
})

const mp = () => require('../lib/mercadopago') as typeof import('../lib/mercadopago')
const pasarela = () => require('../lib/pasarela') as typeof import('../lib/pasarela')

describe('configuración', () => {
  it('configurado solo con MP_ACCESS_TOKEN presente', () => {
    expect(mp().mpConfigurado()).toBe(false)
    process.env.MP_ACCESS_TOKEN = 'TEST-123'
    expect(mp().mpConfigurado()).toBe(true)
  })

  it('detecta el modo pruebas por el prefijo TEST-', () => {
    process.env.MP_ACCESS_TOKEN = 'TEST-123'
    expect(mp().mpEnPruebas()).toBe(true)
    process.env.MP_ACCESS_TOKEN = 'APP_USR-123'
    expect(mp().mpEnPruebas()).toBe(false)
  })

  it('la base de la API se puede apuntar al falso en QA', () => {
    expect(mp().mpApiBase()).toBe('https://api.mercadopago.com')
    process.env.MP_API_BASE = 'http://127.0.0.1:2527/'
    expect(mp().mpApiBase()).toBe('http://127.0.0.1:2527')
    delete process.env.MP_API_BASE
  })
})

describe('mapeo de estados de Mercado Pago', () => {
  it('approved → APPROVED; rejected/cancelled → DECLINED', () => {
    expect(mp().estadoDesdeMp('approved')).toBe('APPROVED')
    expect(mp().estadoDesdeMp('rejected')).toBe('DECLINED')
    expect(mp().estadoDesdeMp('cancelled')).toBe('DECLINED')
  })

  it('refunded/charged_back → VOIDED; lo demás sigue pendiente', () => {
    expect(mp().estadoDesdeMp('refunded')).toBe('VOIDED')
    expect(mp().estadoDesdeMp('charged_back')).toBe('VOIDED')
    expect(mp().estadoDesdeMp('pending')).toBe('PENDING')
    expect(mp().estadoDesdeMp('in_process')).toBe('PENDING')
    expect(mp().estadoDesdeMp(undefined)).toBe('PENDING')
  })
})

describe('prioridad entre pasarelas', () => {
  it('sin llaves no hay pago en línea', () => {
    expect(pasarela().pasarelaActiva()).toBeNull()
  })

  it('solo Mercado Pago → mercadopago (la interina)', () => {
    process.env.MP_ACCESS_TOKEN = 'TEST-123'
    expect(pasarela().pasarelaActiva()).toBe('mercadopago')
  })

  it('con las llaves de Wompi puestas, Wompi manda (aunque MP siga configurado)', () => {
    process.env.MP_ACCESS_TOKEN = 'TEST-123'
    process.env.WOMPI_PUBLIC_KEY = 'pub_test_a'
    process.env.WOMPI_PRIVATE_KEY = 'prv_test_b'
    process.env.WOMPI_INTEGRITY_SECRET = 'c'
    process.env.WOMPI_EVENTS_SECRET = 'd'
    expect(pasarela().pasarelaActiva()).toBe('wompi')
  })
})
