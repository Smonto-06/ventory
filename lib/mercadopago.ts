// Pasarela de pagos Mercado Pago (Checkout Pro) — pago de la mensualidad.
//
// Es la pasarela interina mientras Samuel completa el registro de Wompi
// (Mercado Pago acepta persona natural con solo cédula). Si las llaves de
// Wompi están configuradas, Wompi tiene prioridad (ver lib/pasarela.ts).
//
// Flujo:
//  1. POST /api/plan/checkout crea una "preferencia" en Mercado Pago con la
//     referencia del PlanPayment y devuelve la URL del checkout (init_point).
//     La tarjeta/PSE se digita en la página de Mercado Pago, nunca aquí.
//  2. Mercado Pago avisa a /api/mercadopago/eventos con el id del pago.
//  3. El webhook NO confía en lo que le llega: consulta ese pago directamente
//     a la API de Mercado Pago con nuestro token (servidor a servidor) y solo
//     aprueba si allá figura aprobado, con nuestra referencia y monto exacto.
//     Por eso un webhook falsificado no puede activar nada.
//
// Solo requiere UNA variable: MP_ACCESS_TOKEN (token de prueba TEST-… o de
// producción APP_USR-…). Sin ella, esta pasarela no existe.

import { PLAN_PRECIO_COP } from '@/lib/wompi'

function env(name: string): string {
  return process.env[name]?.trim() ?? ''
}

/** ¿Está el token? (feature-flag de esta pasarela) */
export function mpConfigurado(): boolean {
  return !!env('MP_ACCESS_TOKEN')
}

/** ¿Token de prueba? */
export function mpEnPruebas(): boolean {
  return env('MP_ACCESS_TOKEN').startsWith('TEST-')
}

/** Base de la API (MP_API_BASE la sobreescribe en QA local) */
export function mpApiBase(): string {
  const override = env('MP_API_BASE')
  if (override) return override.replace(/\/$/, '')
  return 'https://api.mercadopago.com'
}

const cabeceras = () => ({
  Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`,
  'Content-Type': 'application/json',
})

/** Estado de Mercado Pago → estado de PlanPayment */
export function estadoDesdeMp(status: string | undefined): 'APPROVED' | 'DECLINED' | 'VOIDED' | 'PENDING' {
  if (status === 'approved') return 'APPROVED'
  if (status === 'rejected' || status === 'cancelled') return 'DECLINED'
  if (status === 'refunded' || status === 'charged_back') return 'VOIDED'
  return 'PENDING' // pending · in_process · authorized…
}

export interface PagoMp {
  id: string
  status?: string
  external_reference?: string
  transaction_amount?: number
  currency_id?: string
  payment_method_id?: string
  date_approved?: string | null
}

/**
 * Crea la preferencia de pago y devuelve la URL del checkout.
 * El monto va en pesos (Mercado Pago no usa centavos en COP).
 */
export async function crearPreferencia(opts: {
  reference: string
  redirectUrl: string
  notificationUrl: string
}): Promise<string | null> {
  try {
    const res = await fetch(`${mpApiBase()}/checkout/preferences`, {
      method: 'POST',
      headers: cabeceras(),
      body: JSON.stringify({
        items: [
          {
            title: 'Ventory POS — mensualidad',
            description: 'Plan mensual de Ventory ($59.900, IVA incluido)',
            quantity: 1,
            unit_price: PLAN_PRECIO_COP,
            currency_id: 'COP',
          },
        ],
        external_reference: opts.reference,
        back_urls: { success: opts.redirectUrl, pending: opts.redirectUrl, failure: opts.redirectUrl },
        auto_return: 'approved',
        notification_url: opts.notificationUrl,
        statement_descriptor: 'VENTORY',
      }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = (await res.json()) as { init_point?: string; sandbox_init_point?: string }
    // el token de prueba también funciona con init_point; sandbox_init_point
    // es el respaldo para cuentas de prueba viejas
    return body.init_point ?? body.sandbox_init_point ?? null
  } catch {
    return null
  }
}

/** Consulta un pago por su id en Mercado Pago (la verificación del webhook) */
export async function consultarPagoMp(id: string): Promise<PagoMp | null> {
  try {
    const res = await fetch(`${mpApiBase()}/v1/payments/${encodeURIComponent(id)}`, {
      headers: cabeceras(),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as PagoMp
  } catch {
    return null
  }
}

/**
 * Consulta de respaldo: el pago más reciente de una referencia (cuando el
 * webhook aún no ha llegado). Prefiere el aprobado si hay varios intentos.
 */
export async function consultarPagoPorReferencia(reference: string): Promise<PagoMp | null> {
  try {
    const res = await fetch(
      `${mpApiBase()}/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc`,
      { headers: cabeceras(), cache: 'no-store' },
    )
    if (!res.ok) return null
    const body = (await res.json()) as { results?: PagoMp[] }
    const lista = body.results ?? []
    if (!lista.length) return null
    return lista.find((p) => p.status === 'approved') ?? lista[0]
  } catch {
    return null
  }
}
