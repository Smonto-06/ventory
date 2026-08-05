import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, badRequest, serverError } from '@/lib/api-helpers'
import { incluirCotizacion as incluir, serializarCotizacion as serializar } from '@/lib/cotizaciones'

export const dynamic = 'force-dynamic'

const ActualizarSchema = z.object({
  /// 'cancel' anula la cotización; 'extend' le da más días de validez
  action: z.enum(['cancel', 'extend']),
  validDays: z.number().int().min(1).max(180).optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return unauthorized()

    const cot = await db.quote.findFirst({
      where: { id: params.id, businessId: user.businessId },
      include: incluir,
    })
    if (!cot) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    return NextResponse.json({ quote: serializar(cot) })
  } catch (error) {
    return serverError('GET /api/quotes/[id]', error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return unauthorized()

    const cot = await db.quote.findFirst({
      where: { id: params.id, businessId: user.businessId },
      select: { id: true, status: true },
    })
    if (!cot) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return badRequest('JSON inválido')
    }
    const parsed = ActualizarSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    // Una cotización ya convertida es historia: se quedó ligada a una venta y
    // no se puede anular ni revivir sin desalinear los dos documentos.
    if (cot.status === 'CONVERTED') {
      return badRequest('Esta cotización ya se convirtió en venta')
    }

    if (parsed.data.action === 'cancel') {
      if (cot.status === 'CANCELLED') return badRequest('Ya estaba anulada')
      const actualizada = await db.quote.update({
        where: { id: cot.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: incluir,
      })
      db.auditLog
        .create({
          data: { action: 'UPDATE', entity: 'Quote', entityId: cot.id, payload: { action: 'cancel' }, userId: user.id },
        })
        .catch(() => {})
      return NextResponse.json({ quote: serializar(actualizada) })
    }

    // extender la validez
    if (cot.status === 'CANCELLED') return badRequest('Está anulada: no se puede extender')
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (parsed.data.validDays ?? 8))
    validUntil.setHours(23, 59, 59, 999)
    const actualizada = await db.quote.update({
      where: { id: cot.id },
      data: { validUntil },
      include: incluir,
    })
    return NextResponse.json({ quote: serializar(actualizada) })
  } catch (error) {
    return serverError('PATCH /api/quotes/[id]', error)
  }
}
