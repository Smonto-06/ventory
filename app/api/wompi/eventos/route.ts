import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aplicarPagoAprobado, revertirPagoAprobado } from '@/lib/plan'
import { wompiConfigurado, eventoValido, EventoWompi, referenciaCoincide } from '@/lib/wompi'

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
    // `reference` no está cubierto por el HMAC del evento (solo id/status/
    // amount_in_cents lo están) — un payload real y firmado se podría
    // reenviar cambiando solo la referencia hacia el pago PENDING de otro
    // negocio con el mismo monto. Se cruza contra la propia API de Wompi
    // antes de activar nada; si la API confirma que NO es así, se rechaza.
    // Si la API no responde (ver referenciaCoincide), no se bloquea un pago
    // que el HMAC ya validó solo por una falla de red ajena a este evento.
    const coincide = await referenciaCoincide(tx.reference, tx.id)
    if (coincide === false) {
      console.error(`Wompi: referencia ${tx.reference} no coincide con transacción ${tx.id}`)
      return NextResponse.json({ error: 'Referencia no coincide' }, { status: 422 })
    }
    // `reference` no está cubierto por el HMAC del evento — la única defensa
    // real contra que alguien reenvíe un evento aprobado propio (firma
    // válida) apuntándolo a la referencia PENDING de OTRO negocio (el monto
    // es el mismo para todos: un solo plan) es esta consulta cruzada contra
    // la API de Wompi. Si la API no responde, no hay forma de confirmar NI
    // descartar la manipulación — fallar abierto aquí dejaría esa ventana
    // abierta a activar el negocio equivocado. Se responde con un error para
    // que Wompi reintente el webhook más tarde (su política reintenta un
    // webhook con respuesta no-2xx); el respaldo de consultarTransaccion() al
    // volver del checkout también puede recuperarlo mientras tanto.
    if (coincide === null) {
      console.error(`Wompi: no se pudo verificar la referencia ${tx.reference} contra la API (reintentará)`)
      return NextResponse.json({ error: 'No se pudo verificar la transacción' }, { status: 503 })
    }
    await aplicarPagoAprobado(pago.id, {
      wompiId: tx.id,
      paymentMethod: tx.payment_method_type,
      finalizedAt: tx.finalized_at,
    })
  } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
    // Una referencia se puede reintentar con VARIAS transacciones (id)
    // distintas. Si el pago ya está APPROVED por una transacción B, pero
    // este evento de rechazo llega tarde y es de una transacción A anterior
    // (un intento fallido previo al que sí aprobó), no representa una
    // reversión de B — sería tratar un evento viejo y ya superado como si
    // revocara el pago vigente. Solo cuenta como reversión si es la MISMA
    // transacción que quedó registrada como aprobada.
    if (pago.status === 'APPROVED' && pago.wompiId !== tx.id) {
      return NextResponse.json({ ok: true, ignorado: 'evento de una transacción ya superada' })
    }
    // Si el pago YA estaba APPROVED (reembolso/contracargo, no un simple
    // rechazo de intento), esto también suspende el negocio — ver el
    // comentario de revertirPagoAprobado.
    await revertirPagoAprobado(pago.id, tx.status as 'DECLINED' | 'VOIDED' | 'ERROR', {
      wompiId: tx.id,
      paymentMethod: tx.payment_method_type,
    })
  }

  return NextResponse.json({ ok: true })
}
