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
import { cashPortion } from '@/lib/pos'

export const dynamic = 'force-dynamic'

/** Otra anulación concurrente de la misma venta ya ganó la carrera */
class AlreadyVoidedError extends Error {
  constructor() {
    super('La venta ya está anulada')
    this.name = 'AlreadyVoidedError'
  }
}

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
      include: { items: true, returns: true, payments: true },
    })
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (sale.status === 'CANCELLED') return badRequest('La venta ya está anulada')

    // Valor ya devuelto en devoluciones previas: se suma el totalRefund real
    // que quedó guardado en cada SaleReturn (calculado con la fórmula
    // proporcional redondeada UNA vez, igual que return/route.ts), no una
    // reconstrucción con otra fórmula — dos redondeos distintos del mismo
    // valor pueden no coincidir y dejar $1 de más o de menos en el cajón.
    const refunded = sale.returns.reduce((sum, r) => sum + Number(r.totalRefund), 0)
    const refund = Math.max(0, Number(sale.total) - refunded)
    const isCredit = sale.paymentMethod === 'CREDIT'

    // Solo la parte de la venta que SÍ entró en efectivo sale del cajón al
    // anular; tarjeta/transferencia no lo tocan (misma regla que cashPortion()
    // ya aplica para las ventas), proporcional a lo que queda por anular.
    const saleTotal = Number(sale.total)
    const saleCashPortion = cashPortion({ total: saleTotal, paymentMethod: sale.paymentMethod, payments: sale.payments })
    const cashRefund = saleTotal > 0 ? Math.round((refund * saleCashPortion) / saleTotal) : 0

    // Las ventas ANULADAS se excluyen de "ventas en efectivo del turno"
    // (Sale.status ya no es COMPLETED), así que si la venta sigue en el
    // MISMO turno todavía abierto donde se hizo, esa exclusión YA le resta
    // su parte en efectivo al esperado — crear además un gasto de caja
    // restaría el mismo dinero dos veces. Solo hace falta el gasto cuando el
    // efectivo tiene que salir de un cajón DISTINTO al de la venta original
    // (turno ya cerrado, u otro cajero anulando desde su propio turno).
    let cashSessionId: string | null = null
    if (cashRefund > 0 && !isCredit) {
      const cashSession = await findOpenCashSession(db, sale.branchId, user.id)
      if (cashSession && cashSession.id !== sale.cashSessionId) {
        cashSessionId = cashSession.id
      } else if (!cashSession) {
        return badRequest('No hay caja abierta. Abre un turno antes de anular ventas.')
      }
    }

    const voided = await db.$transaction(async (tx) => {
      // Reclama la anulación PRIMERO y de forma condicionada al estado
      // vigente: si dos anulaciones de la misma venta llegan casi
      // simultáneas (doble clic, reintento de red), la segunda no encuentra
      // fila COMPLETED que actualizar y se revierte entera — nunca se
      // duplica el reintegro de stock ni el gasto de caja.
      const marcada = await tx.sale.updateMany({
        where: { id: sale.id, status: 'COMPLETED' },
        data: {
          status: 'CANCELLED',
          voidedAt: new Date(),
          voidedById: user.id,
          voidReason: reason,
        },
      })
      if (marcada.count === 0) {
        throw new AlreadyVoidedError()
      }

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

      // Gasto de caja por la parte en efectivo de lo no devuelto (venta de contado/combinada)
      if (cashRefund > 0 && !isCredit && cashSessionId) {
        await tx.cashMovement.create({
          data: {
            type: CashMovementType.EXPENSE,
            amount: cashRefund,
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

      return tx.sale.findUniqueOrThrow({
        where: { id: sale.id },
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
    if (error instanceof AlreadyVoidedError) {
      return badRequest(error.message)
    }
    return serverError('POST /api/sales/[id]/void', error)
  }
}
