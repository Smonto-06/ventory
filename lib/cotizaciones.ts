// Forma en que se leen y se devuelven las cotizaciones, compartida por las
// rutas de la API. Vive fuera de app/api porque un archivo de ruta de Next
// solo puede exportar los verbos HTTP.

import { db } from '@/lib/db'

/** OPEN + vencida = "vencida" (se deriva, no hace falta una tarea que las marque) */
function estadoVisible(q: { status: string; validUntil: Date }): string {
  if (q.status === 'OPEN' && q.validUntil.getTime() < Date.now()) return 'EXPIRED'
  return q.status
}

export const incluirCotizacion = {
  customer: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  sale: { select: { id: true, folio: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unitOfMeasure: true, imageUrl: true } },
    },
  },
} as const

type QuoteConIncludes = Awaited<ReturnType<typeof db.quote.findFirst<{ include: typeof incluirCotizacion }>>>

export function serializarCotizacion(q: NonNullable<QuoteConIncludes>) {
  return {
    id: q.id,
    folio: q.folio,
    status: estadoVisible(q),
    rawStatus: q.status,
    subtotal: Number(q.subtotal),
    discountAmount: Number(q.discountAmount),
    discountIsPct: q.discountIsPct,
    discountPct: Number(q.discountPct),
    total: Number(q.total),
    notes: q.notes,
    validUntil: q.validUntil,
    convertedAt: q.convertedAt,
    cancelledAt: q.cancelledAt,
    createdAt: q.createdAt,
    customer: q.customer,
    customerName: q.customerName,
    createdBy: q.createdBy,
    branch: q.branch,
    sale: q.sale,
    items: q.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      product: i.product,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discountPct: Number(i.discountPct),
      total: Number(i.total),
    })),
  }
}
