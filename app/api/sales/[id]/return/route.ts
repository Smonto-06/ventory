import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import {
  unauthorized,
  badRequest,
  serverError,
  findOpenCashSession,
  serialize,
} from '@/lib/api-helpers'
import { CashMovementType, MovementType } from '@prisma/client'

export const dynamic = 'force-dynamic'

const ReturnSchema = z.object({
  items: z
    .array(
      z.object({
        saleItemId: z.string().min(1),
        quantity: z.number().positive(),
      }),
    )
    .min(1, 'Indica los artículos a devolver'),
  // false = devolución (reembolso en efectivo → gasto de caja)
  // true  = cambio (el valor devuelto se aplica como descuento $ en una nueva venta)
  exchange: z.boolean().default(false),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = ReturnSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { exchange, notes } = parsed.data

  try {
    const sale = await db.sale.findFirst({
      where: { id: params.id, branch: { businessId: user.businessId } },
      include: { items: true },
    })
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (sale.status === 'CANCELLED') return badRequest('La venta está anulada')

    // Validar cantidades: tope disponible = qty − retQty; reembolso proporcional al valor de línea
    const itemMap = new Map(sale.items.map((i) => [i.id, i]))
    const toReturn: Array<{ saleItemId: string; productId: string; quantity: number; refund: number }> = []
    for (const r of parsed.data.items) {
      const item = itemMap.get(r.saleItemId)
      if (!item) return badRequest('Artículo no pertenece a esta venta')
      const available = Number(item.quantity) - Number(item.returnedQty)
      const q = Math.min(r.quantity, available)
      if (q <= 0) continue
      const unitValue = Math.round(Number(item.total) / Number(item.quantity))
      toReturn.push({ saleItemId: item.id, productId: item.productId, quantity: q, refund: unitValue * q })
    }
    const totalRefund = toReturn.reduce((sum, r) => sum + r.refund, 0)
    if (totalRefund <= 0 && toReturn.length === 0) {
      return badRequest('No hay cantidades disponibles para devolver')
    }

    // La devolución (no el cambio) reembolsa efectivo: requiere caja abierta
    let cashSessionId: string | null = null
    if (!exchange && totalRefund > 0) {
      const cashSession = await findOpenCashSession(db, sale.branchId)
      if (!cashSession) {
        return badRequest('No hay caja abierta. Abre un turno antes de registrar devoluciones.')
      }
      cashSessionId = cashSession.id
    }

    const saleReturn = await db.$transaction(async (tx) => {
      // Regresa stock por artículo
      for (const r of toReturn) {
        const inv = await tx.inventory.upsert({
          where: { productId_branchId: { productId: r.productId, branchId: sale.branchId } },
          create: { productId: r.productId, branchId: sale.branchId, quantity: 0 },
          update: {},
        })
        const quantityAfter = Number(inv.quantity) + r.quantity
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: quantityAfter, lowStock: quantityAfter <= Number(inv.minStock) },
        })
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.RETURN,
            quantity: r.quantity,
            quantityBefore: Number(inv.quantity),
            quantityAfter,
            reason: `${exchange ? 'Cambio' : 'Devolución'} ${sale.folio}`,
            inventoryId: inv.id,
            saleItemId: r.saleItemId,
            createdById: user.id,
          },
        })
        await tx.saleItem.update({
          where: { id: r.saleItemId },
          data: { returnedQty: { increment: r.quantity } },
        })
      }

      // Devolución → gasto de caja. Cambio → sin gasto (se aplica como descuento en nueva venta).
      let cashMovementId: string | null = null
      if (!exchange && totalRefund > 0 && cashSessionId) {
        const movement = await tx.cashMovement.create({
          data: {
            type: CashMovementType.EXPENSE,
            amount: totalRefund,
            description: 'Devolución',
            comment: sale.folio,
            cashSessionId,
            createdById: user.id,
          },
        })
        cashMovementId = movement.id
      }

      return tx.saleReturn.create({
        data: {
          type: exchange ? 'EXCHANGE' : 'REFUND',
          totalRefund,
          notes,
          saleId: sale.id,
          cashMovementId,
          createdById: user.id,
          items: {
            create: toReturn.map((r) => ({
              saleItemId: r.saleItemId,
              quantity: r.quantity,
              refundAmount: r.refund,
            })),
          },
        },
        include: { items: true },
      })
    })

    db.auditLog
      .create({
        data: {
          action: exchange ? 'EXCHANGE' : 'RETURN',
          entity: 'Sale',
          entityId: sale.id,
          payload: { folio: sale.folio, totalRefund, items: toReturn.length },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json(
      {
        return: serialize(saleReturn),
        // Para "cambio": el frontend aplica este valor como descuento $ en la nueva venta
        creditForExchange: exchange ? totalRefund : 0,
      },
      { status: 201 },
    )
  } catch (error) {
    return serverError('POST /api/sales/[id]/return', error)
  }
}
