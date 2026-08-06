import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aplicarPagoAprobado } from '@/lib/plan'
import { wompiConfigurado, eventoValido, EventoWompi } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

// Webhook de Wompi (URL de eventos). Llega sin sesión — el middleware lo
// exceptúa igual que /api/cron — y se protege con la firma del evento:
// sin checksum válido (secreto de eventos) se rechaza con 403.
//
// Idempotente a propósito: Wompi puede reenviar el mismo evento varias veces
// y la consulta de respaldo puede llegar primero; los 30 días solo se suman
// una vez (updateMany condicionado a PENDING dentro de aplicarPagoAprobado).
export async function POST(req: NextRequest) {
  if (!wompiConfigurado()) {
    return NextResponse.json({ error: 'Pago en línea no habilitado' }, { status: 404 })
  }

  let evento: EventoWompi
  try {
    evento = (await req.json()) as EventoWompi
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!eventoValido(evento)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
  }

  if (evento.event !== 'transaction.updated' || !evento.data.transaction) {
    return NextResponse.json({ ok: true, ignorado: evento.event })
  }

  const tx = evento.data.transaction
  const pago = await db.planPayment.findUnique({ where: { reference: tx.reference } })
  if (!pago) {
    // Referencia ajena (otro producto del mismo comercio Wompi): no es error
    return NextResponse.json({ ok: true, ignorado: 'referencia desconocida' })
  }

  // El monto del evento debe ser el del pago creado: la firma de integridad ya
  // lo protege en el checkout, pero verificarlo aquí no cuesta nada.
  if (tx.amount_in_cents !== pago.amountInCents || tx.currency !== pago.currency) {
    return NextResponse.json({ error: 'Monto no coincide' }, { status: 422 })
  }

  if (tx.status === 'APPROVED') {
    await aplicarPagoAprobado(pago.id, {
      wompiId: tx.id,
      paymentMethod: tx.payment_method_type,
      finalizedAt: tx.finalized_at,
    })
  } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
    await db.planPayment.updateMany({
      where: { id: pago.id, status: 'PENDING' },
      data: { status: tx.status as 'DECLINED' | 'VOIDED' | 'ERROR', wompiId: tx.id, paymentMethod: tx.payment_method_type },
    })
  }

  return NextResponse.json({ ok: true })
}
