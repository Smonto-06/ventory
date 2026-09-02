// Pasarela de pagos Wompi (Bancolombia) — pago de la mensualidad del plan.
//
// Flujo:
//  1. El dueño pulsa "Pagar mi plan" → POST /api/plan/checkout crea un
//     PlanPayment PENDING con una referencia única y lo manda al Web Checkout
//     de Wompi (la página de pago de ellos; la tarjeta nunca pasa por Ventory).
//  2. Wompi confirma el pago llamando a /api/wompi/eventos (webhook firmado).
//  3. Como respaldo, al volver del checkout la app consulta la transacción por
//     referencia directamente a la API de Wompi (por si el webhook se demora).
//
// Sin las 4 variables configuradas, nada de esto existe: el sistema sigue con
// activación manual desde el super admin, como siempre.
//
// Seguridad:
//  - Firma de integridad: sha256(referencia + monto + moneda + secreto) va en
//    la URL del checkout; impide que alguien cambie el monto.
//  - Eventos: Wompi firma cada webhook con sha256(propiedades + timestamp +
//    secreto de eventos); un evento sin firma válida se rechaza con 403.

import { createHash, timingSafeEqual } from 'crypto'

/** Plan único: $59.900 COP al mes. Wompi trabaja en centavos. */
export const PLAN_PRECIO_COP = 59_900
export const PLAN_CENTAVOS = PLAN_PRECIO_COP * 100
export const PLAN_DIAS = 30

function env(name: string): string {
  return process.env[name]?.trim() ?? ''
}

/** ¿Están las 4 llaves? (feature-flag del pago en línea) */
export function wompiConfigurado(): boolean {
  return !!(
    env('WOMPI_PUBLIC_KEY') &&
    env('WOMPI_PRIVATE_KEY') &&
    env('WOMPI_INTEGRITY_SECRET') &&
    env('WOMPI_EVENTS_SECRET')
  )
}

/** ¿Llaves de prueba (sandbox)? Se decide por el prefijo pub_test_ */
export function wompiEnPruebas(): boolean {
  return env('WOMPI_PUBLIC_KEY').startsWith('pub_test_')
}

/** Base de la API de Wompi (WOMPI_API_BASE la sobreescribe en QA local) */
export function wompiApiBase(): string {
  const override = env('WOMPI_API_BASE')
  if (override) return override.replace(/\/$/, '')
  return wompiEnPruebas() ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1'
}

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex')

/** Firma de integridad que exige el Web Checkout */
export function firmaIntegridad(reference: string, amountInCents: number, currency = 'COP'): string {
  return sha256(`${reference}${amountInCents}${currency}${env('WOMPI_INTEGRITY_SECRET')}`)
}

/** URL completa del Web Checkout de Wompi para un pago */
export function urlCheckout(opts: { reference: string; amountInCents: number; redirectUrl: string; currency?: string }): string {
  const currency = opts.currency ?? 'COP'
  const base = env('WOMPI_CHECKOUT_BASE') || 'https://checkout.wompi.co/p/'
  const params = new URLSearchParams({
    'public-key': env('WOMPI_PUBLIC_KEY'),
    currency,
    'amount-in-cents': String(opts.amountInCents),
    reference: opts.reference,
    'signature:integrity': firmaIntegridad(opts.reference, opts.amountInCents, currency),
    'redirect-url': opts.redirectUrl,
  })
  return `${base}?${params.toString()}`
}

// Forma del evento que envía Wompi al webhook
export interface EventoWompi {
  event: string
  data: {
    transaction?: {
      id: string
      status: string
      reference: string
      amount_in_cents: number
      currency: string
      payment_method_type?: string
      finalized_at?: string | null
    }
  }
  signature?: { properties: string[]; checksum: string }
  timestamp?: number
  sent_at?: string
}

/** Saca un valor anidado del evento por ruta "transaction.id" */
function propiedad(data: EventoWompi['data'], ruta: string): string {
  let actual: unknown = data
  for (const parte of ruta.split('.')) {
    if (actual === null || typeof actual !== 'object') return ''
    actual = (actual as Record<string, unknown>)[parte]
  }
  return actual === undefined || actual === null ? '' : String(actual)
}

/**
 * Verifica la firma del webhook: sha256 de los valores de signature.properties
 * (en su orden) + timestamp + secreto de eventos.
 */
export function eventoValido(evento: EventoWompi): boolean {
  const firma = evento.signature
  if (!firma?.checksum || !Array.isArray(firma.properties) || evento.timestamp === undefined) return false
  const concatenado = firma.properties.map((p) => propiedad(evento.data, p)).join('')
  const esperado = sha256(`${concatenado}${evento.timestamp}${env('WOMPI_EVENTS_SECRET')}`)
  const recibido = firma.checksum.toLowerCase()
  // Comparación en tiempo constante: sha256 siempre produce 64 hex chars,
  // pero por si el checksum recibido viniera con otra longitud, comparar
  // largo primero evita que timingSafeEqual lance por buffers desiguales.
  if (recibido.length !== esperado.length) return false
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(recibido))
}

async function listarTransacciones(
  reference: string,
): Promise<Array<{ id: string; status: string; payment_method_type?: string; finalized_at?: string | null; created_at?: string }> | null> {
  try {
    const res = await fetch(`${wompiApiBase()}/transactions?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${env('WOMPI_PRIVATE_KEY')}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: Array<{ id: string; status: string; payment_method_type?: string; finalized_at?: string | null; created_at?: string }> }
    return body.data ?? []
  } catch {
    return null
  }
}

/**
 * Consulta de respaldo: busca en la API de Wompi la transacción de una
 * referencia (cuando el webhook aún no ha llegado). Devuelve la más reciente.
 */
export async function consultarTransaccion(
  reference: string,
): Promise<{ id: string; status: string; payment_method_type?: string; finalized_at?: string | null } | null> {
  const lista = await listarTransacciones(reference)
  if (!lista || !lista.length) return null
  return lista[lista.length - 1]
}

/**
 * Cruza el `reference` del webhook contra la propia API de Wompi: el HMAC
 * del evento firma `id`/`status`/`amount_in_cents`, pero NO `reference` — un
 * payload real y firmado se podría reenviar cambiando solo la referencia
 * hacia el pago PENDING de otro negocio con el mismo monto, sin invalidar el
 * checksum. Si la API confirma que esa transacción (por id) sí pertenece a
 * esa referencia, `reference` queda efectivamente atado a datos que la propia
 * API de Wompi entrega (HTTPS + nuestra llave privada), no solo al HMAC.
 *
 * true = confirmado; false = la API respondió pero esa transacción no está
 * en la lista de esa referencia (evidencia de manipulación → rechazar);
 * null = no se pudo confirmar (API de Wompi inalcanzable) — no es evidencia
 * de nada, así que no bloquea por sí solo un pago que el HMAC ya validó.
 */
export async function referenciaCoincide(reference: string, transactionId: string): Promise<boolean | null> {
  const lista = await listarTransacciones(reference)
  if (lista === null) return null
  return lista.some((t) => t.id === transactionId)
}
