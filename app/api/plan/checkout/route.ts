import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isFullAdmin } from '@/lib/api-helpers'
import { planInfo, aplicarPagoAprobado } from '@/lib/plan'
import { wompiEnPruebas, urlCheckout, consultarTransaccion, PLAN_CENTAVOS, PLAN_PRECIO_COP } from '@/lib/wompi'
import { mpEnPruebas, crearPreferencia, consultarPagoPorReferencia, estadoDesdeMp } from '@/lib/mercadopago'
import { pasarelaActiva } from '@/lib/pasarela'

export const dynamic = 'force-dynamic'

// POST: crea el pago de la mensualidad y devuelve la URL del checkout de la
// pasarela activa (Wompi si tiene llaves; si no, Mercado Pago). La tarjeta,
// Nequi o PSE se digita en la página de la pasarela, nunca aquí.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isFullAdmin(user)) return forbidden('Solo el administrador paga el plan')

  // SUSPENDED es una decisión manual del super admin (no un simple vencimiento
  // de plan/prueba): sin este chequeo, un negocio suspendido podía pagar por
  // su cuenta y reactivarse solo, saltándose por completo la revisión del
  // super admin que motivó la suspensión.
  const negocioActual = await db.business.findUnique({
    where: { id: user.businessId },
    select: { status: true },
  })
  if (negocioActual?.status === 'SUSPENDED') {
    return NextResponse.json(
      { error: 'Tu plan está suspendido. Escríbenos a ventorypos@gmail.com para reactivarlo.', code: 'PLAN_BLOCKED' },
      { status: 403 },
    )
  }

  const pasarela = pasarelaActiva()
  if (!pasarela) {
    return NextResponse.json(
      { error: 'El pago en línea no está habilitado. Escríbenos a ventorypos@gmail.com.', code: 'PAGO_NO_DISPONIBLE' },
      { status: 409 },
    )
  }

  try {
    // Referencia única y legible: con ella vuelve el evento de la pasarela
    const reference = `VEN-${user.businessId.slice(-6)}-${Date.now().toString(36)}`.toUpperCase()
    const origin = req.nextUrl.origin
    const redirectUrl = `${origin}/app?pago=${encodeURIComponent(reference)}`

    let url: string | null
    if (pasarela === 'wompi') {
      url = urlCheckout({ reference, amountInCents: PLAN_CENTAVOS, redirectUrl })
    } else {
      url = await crearPreferencia({
        reference,
        redirectUrl,
        notificationUrl: `${origin}/api/mercadopago/eventos`,
      })
      if (!url) {
        return NextResponse.json(
          { error: 'Mercado Pago no respondió. Inténtalo de nuevo en un momento.' },
          { status: 502 },
        )
      }
    }

    const pago = await db.planPayment.create({
      data: { businessId: user.businessId, reference, amountInCents: PLAN_CENTAVOS, gateway: pasarela },
    })
    return NextResponse.json(
      {
        url,
        reference: pago.reference,
        amount: PLAN_PRECIO_COP,
        gateway: pasarela,
        sandbox: pasarela === 'wompi' ? wompiEnPruebas() : mpEnPruebas(),
      },
      { status: 201 },
    )
  } catch (error) {
    return serverError('POST /api/plan/checkout', error)
  }
}

// GET ?ref=…: estado de un pago al volver del checkout. Si el webhook aún no
// ha llegado, consulta la transacción directamente a la pasarela (respaldo).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  const ref = req.nextUrl.searchParams.get('ref')?.trim()
  if (!ref) return badRequest('Falta la referencia')

  try {
    let pago = await db.planPayment.findFirst({
      where: { reference: ref, businessId: user.businessId },
    })
    if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    // No solo PENDING: tanto Wompi como Mercado Pago dejan reintentar un pago
    // rechazado sin cambiar de referencia — si esta referencia quedó
    // DECLINED/VOIDED/ERROR pero el comprador reintentó y esta vez aprobó,
    // hay que volver a consultar la pasarela, no quedarse callado para
    // siempre solo porque el estado local ya no es PENDING.
    const reintentable = pago.status !== 'APPROVED'

    if (reintentable && pago.gateway === 'wompi') {
      const tx = await consultarTransaccion(ref)
      if (tx?.status === 'APPROVED') {
        await aplicarPagoAprobado(pago.id, {
          wompiId: tx.id,
          paymentMethod: tx.payment_method_type,
          finalizedAt: tx.finalized_at,
        })
      } else if (tx && ['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
        await db.planPayment.updateMany({
          where: { id: pago.id, status: { not: 'APPROVED' } },
          data: { status: tx.status as 'DECLINED' | 'VOIDED' | 'ERROR', wompiId: tx.id, paymentMethod: tx.payment_method_type },
        })
      }
      pago = await db.planPayment.findUniqueOrThrow({ where: { id: pago.id } })
    } else if (reintentable && pago.gateway === 'mercadopago') {
      const mp = await consultarPagoPorReferencia(ref)
      const estado = estadoDesdeMp(mp?.status)
      // el monto exacto también se exige en el respaldo
      if (mp && estado === 'APPROVED' && mp.transaction_amount === PLAN_PRECIO_COP && mp.currency_id === 'COP') {
        await aplicarPagoAprobado(pago.id, {
          wompiId: String(mp.id),
          paymentMethod: mp.payment_method_id,
          finalizedAt: mp.date_approved,
        })
      } else if (mp && (estado === 'DECLINED' || estado === 'VOIDED')) {
        await db.planPayment.updateMany({
          where: { id: pago.id, status: { not: 'APPROVED' } },
          data: { status: estado, wompiId: String(mp.id), paymentMethod: mp.payment_method_id },
        })
      }
      pago = await db.planPayment.findUniqueOrThrow({ where: { id: pago.id } })
    }

    const negocio = await db.business.findUniqueOrThrow({
      where: { id: user.businessId },
      select: { status: true, trialEndsAt: true, paidUntil: true },
    })
    return NextResponse.json({
      status: pago.status,
      paidAt: pago.paidAt,
      amount: Math.round(pago.amountInCents / 100),
      plan: planInfo(negocio),
    })
  } catch (error) {
    return serverError('GET /api/plan/checkout', error)
  }
}
