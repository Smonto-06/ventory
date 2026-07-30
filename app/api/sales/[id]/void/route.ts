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
import { moveStock } from '@/lib/inventory'

export const dynamic = 'force-dynamic'

const VoidSchema = z.object({ reason: z.string().optional() })

/**
 * Anulación de venta: regresa el stock restante (qty − retQty), registra gasto de caja
 * por el valor no devuelto, y marca la venta como anulada (excluida de totales y
 * reportes; visible en historial). Si la venta fue a crédito, se revierte el saldo
 * del cliente en lugar de generar gasto de caja.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  let reason: string | undefined
  try {
    const body = await req.json()
    const parsed = VoidSchema.safeParse(body)
    if (parsed.success) reason = parsed.data.reason
  } catch {
    // cuerpo opcional
  }

  try {
    const sale = await db.sale.findFirst({
      where: { id: params.id, branch: { businessId: user.businessId } },
      include: { items: true, returns: true },
    })
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (sale.status === 'CANCELLED') return badRequest('La venta ya está anulada')

    // Valor ya devuelto en devoluciones previas (unitario proporcional × retQty)
    const refunded = sale.items.reduce(
      (sum, it) => sum + Math.round(Number(it.total) / Number(it.quantity)) * Number(it.returnedQty),
      0,
    )
    const refund = Math.max(0, Number(sale.total) - refunded)
    const isCredit = sale.paymentMethod === 'CREDIT'

    let cashSessionId: string | null = null
    if (refund > 0 && !isCredit) {
      const cashSession = await findOpenCashSession(db, sale.branchId)
      if (!cashSession) {
        return badRequest('No hay caja abierta. Abre un turno antes de anular ventas.')
      }
      cashSessionId = cashSession.id
    }

    const voided = await db.$transaction(async (tx) => {
      // Regresa el stock restante de cada artículo
      for (const item of sale.items) {
        const remaining = Number(item.quantity) - Number(item.returnedQty)
        if (remaining <= 0) continue
        const move = await moveStock(tx, item.productId, sale.branchId, remaining)
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.RETURN,
            quantity: remaining,
            quantityBefore: move.before,
            quantityAfter: move.after,
            reason: `Anulación ${sale.folio}`,
            inventoryId: move.inventoryId,
            saleItemId: item.id,
            createdById: user.id,
          },
        })
      }

      // Gasto de caja por lo no devuelto (venta de contado/combinada)
      if (refund > 0 && !isCredit && cashSessionId) {
        await tx.cashMovement.create({
          data: {
            type: CashMovementType.EXPENSE,
            amount: refund,
            description: 'Anulación de venta',
            comment: sale.folio,
            cashSessionId,
            createdById: user.id,
          },
        })
      }

      // Venta a crédito: se revierte el saldo del cliente (no hubo efectivo de por medio)
      if (isCredit && sale.customerId && refund > 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: refund } },
        })
      }

      return tx.sale.update({
        where: { id: sale.id },
        data: {
          status: 'CANCELLED',
          voidedAt: new Date(),
          voidedById: user.id,
          voidReason: reason,
        },
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          customer: { select: { id: true, name: true } },
        },
      })
    })

    db.auditLog
      .create({
        data: {
          action: 'VOID',
          entity: 'Sale',
          entityId: sale.id,
          payload: { folio: sale.folio, refund, reason: reason ?? null },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ sale: serialize(voided), refund })
  } catch (error) {
    return serverError('POST /api/sales/[id]/void', error)
  }
}
