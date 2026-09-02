import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aplicarPagoAprobado, revertirPagoAprobado } from '@/lib/plan'
import { mpConfigurado, consultarPagoMp, estadoDesdeMp } from '@/lib/mercadopago'
import { PLAN_PRECIO_COP } from '@/lib/wompi'

export const dynamic = 'force-dynamic'

// Sin firma que verificar en la notificación de MP, cualquiera puede pedir
// POST /api/mercadopago/eventos con un id de pago arbitrario y forzar una
// consulta saliente a la API de Mercado Pago con nuestro token — no compromete
// otros negocios (la referencia sí se valida después), pero sí puede agotar
// cuota/latencia del token de la cuenta real. Freno simple por IP, en memoria
// del proceso: no sobrevive a varias instancias serverless, pero encarece lo
// suficiente un abuso sostenido desde una sola fuente sin bloquear el tráfico
// real de MP (una notificación ocasional por pago).
const CONSULTAS_POR_MINUTO = 20
const consultasPorIp = new Map<string, { desde: number; conteo: number }>()
function limiteExcedido(ip: string): boolean {
  const ahora = Date.now()
  const v = consultasPorIp.get(ip)
  if (!v || ahora - v.desde > 60_000) {
    consultasPorIp.set(ip, { desde: ahora, conteo: 1 })
    return false
  }
  v.conteo++
  return v.conteo > CONSULTAS_POR_MINUTO
}

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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'desconocida'
  if (limiteExcedido(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
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
    // Si el pago YA estaba APPROVED, "VOIDED" acá cubre justo el caso de un
    // reembolso o contracargo (estadoDesdeMp mapea refunded/charged_back a
    // VOIDED) — también suspende el negocio si sigue vigente por este pago.
    await revertirPagoAprobado(pago.id, estado, {
      wompiId: String(mp.id),
      paymentMethod: mp.payment_method_id,
    })
  }

  return NextResponse.json({ ok: true })
}
