import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aplicarPagoAprobado } from '@/lib/plan'
import { mpConfigurado, consultarPagoMp, estadoDesdeMp } from '@/lib/mercadopago'
import { PLAN_PRECIO_COP } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

// Webhook de Mercado Pago. Llega sin sesión — el middleware lo exceptúa igual
// que /api/cron y /api/wompi.
//
// Seguridad: este webhook NO confía en el cuerpo que recibe. Lo único que
// toma de la notificación es el id del pago, y con ese id consulta a la API
// de Mercado Pago usando NUESTRO token (servidor a servidor). Solo se aprueba
// si allá figura aprobado, con nuestra referencia y el monto exacto del plan.
// Un webhook falsificado, a lo sumo, nos hace consultar un pago que no existe.
//
// Idempotente: Mercado Pago reenvía notificaciones y la consulta de respaldo
// puede llegar primero; los 30 días solo se suman una vez (updateMany
// condicionado a PENDING dentro de aplicarPagoAprobado).
export async function POST(req: NextRequest) {
  if (!mpConfigurado()) {
    return NextResponse.json({ error: 'Pago en línea no habilitado' }, { status: 404 })
  }

  // El id del pago puede venir en el cuerpo ({data:{id}}) o en la URL (?id=)
  let cuerpo: { type?: string; topic?: string; data?: { id?: string | number } } = {}
  try {
    cuerpo = (await req.json()) as typeof cuerpo
  } catch {
    // notificaciones viejas llegan sin cuerpo JSON, solo con query
  }
  const tipo = cuerpo.type ?? cuerpo.topic ?? req.nextUrl.searchParams.get('type') ?? req.nextUrl.searchParams.get('topic')
  const pagoId = cuerpo.data?.id ?? req.nextUrl.searchParams.get('data.id') ?? req.nextUrl.searchParams.get('id')

  // Solo interesan las notificaciones de pagos; el resto se confirma sin más
  // (responder 200 evita que Mercado Pago reintente eternamente)
  if (tipo !== 'payment' || !pagoId) {
    return NextResponse.json({ ok: true, ignorado: tipo ?? 'sin tipo' })
  }

  // La verdad se consulta en Mercado Pago, no en el cuerpo del webhook
  const mp = await consultarPagoMp(String(pagoId))
  if (!mp || !mp.external_reference) {
    return NextResponse.json({ ok: true, ignorado: 'pago no encontrado en Mercado Pago' })
  }

  const pago = await db.planPayment.findUnique({ where: { reference: mp.external_reference } })
  if (!pago || pago.gateway !== 'mercadopago') {
    return NextResponse.json({ ok: true, ignorado: 'referencia desconocida' })
  }

  if (mp.transaction_amount !== PLAN_PRECIO_COP || mp.currency_id !== 'COP') {
    return NextResponse.json({ error: 'Monto no coincide' }, { status: 422 })
  }

  const estado = estadoDesdeMp(mp.status)
  if (estado === 'APPROVED') {
    await aplicarPagoAprobado(pago.id, {
      wompiId: String(mp.id),
      paymentMethod: mp.payment_method_id,
      finalizedAt: mp.date_approved,
    })
  } else if (estado === 'DECLINED' || estado === 'VOIDED') {
    await db.planPayment.updateMany({
      where: { id: pago.id, status: 'PENDING' },
      data: { status: estado, wompiId: String(mp.id), paymentMethod: mp.payment_method_id },
    })
  }

  return NextResponse.json({ ok: true })
}
