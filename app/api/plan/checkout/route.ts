import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isAdmin } from '@/lib/api-helpers'
import { planInfo, aplicarPagoAprobado } from '@/lib/plan'
import { wompiConfigurado, wompiEnPruebas, urlCheckout, consultarTransaccion, PLAN_CENTAVOS, PLAN_PRECIO_COP } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

// POST: crea el pago de la mensualidad y devuelve la URL del checkout de
// Wompi. La tarjeta/Nequi/PSE se digita en la página de Wompi, nunca aquí.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden('Solo el administrador paga el plan')
  if (!wompiConfigurado()) {
    return NextResponse.json(
      { error: 'El pago en línea no está habilitado. Escríbenos a ventorypos@gmail.com.', code: 'PAGO_NO_DISPONIBLE' },
      { status: 409 },
    )
  }

  try {
    // Referencia única y legible: con ella vuelve el evento de Wompi
    const reference = `VEN-${user.businessId.slice(-6)}-${Date.now().toString(36)}`.toUpperCase()
    const pago = await db.planPayment.create({
      data: { businessId: user.businessId, reference, amountInCents: PLAN_CENTAVOS },
    })
    const origin = req.nextUrl.origin
    const url = urlCheckout({
      reference,
      amountInCents: PLAN_CENTAVOS,
      redirectUrl: `${origin}/app?pago=${encodeURIComponent(reference)}`,
    })
    return NextResponse.json(
      { url, reference: pago.reference, amount: PLAN_PRECIO_COP, sandbox: wompiEnPruebas() },
      { status: 201 },
    )
  } catch (error) {
    return serverError('POST /api/plan/checkout', error)
  }
}

// GET ?ref=…: estado de un pago al volver del checkout. Si el webhook aún no
// ha llegado, consulta la transacción directamente a Wompi (respaldo).
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

    if (pago.status === 'PENDING' && wompiConfigurado()) {
      const tx = await consultarTransaccion(ref)
      if (tx?.status === 'APPROVED') {
        await aplicarPagoAprobado(pago.id, {
          wompiId: tx.id,
          paymentMethod: tx.payment_method_type,
          finalizedAt: tx.finalized_at,
        })
      } else if (tx && ['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
        await db.planPayment.updateMany({
          where: { id: pago.id, status: 'PENDING' },
          data: { status: tx.status as 'DECLINED' | 'VOIDED' | 'ERROR', wompiId: tx.id, paymentMethod: tx.payment_method_type },
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
