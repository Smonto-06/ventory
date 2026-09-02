import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import {
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  isAdmin,
  findOpenCashSession,
  serialize,
} from '@/lib/api-helpers'
import { CashMovementType } from '@prisma/client'

export const dynamic = 'force-dynamic'

/** Otro abono concurrente ya redujo el saldo pendiente por debajo de lo que este abono necesitaba */
class BalanceChangedError extends Error {
  constructor() {
    super('El saldo de la compra cambió por otra operación simultánea. Vuelve a intentar el abono.')
    this.name = 'BalanceChangedError'
  }
}

const PaymentSchema = z.object({
  amount: z.number().positive('El abono debe ser mayor a 0'),
  method: z.enum(['CASH', 'CARD', 'TRANSFER']).default('CASH'),
})

// Abono a una compra a crédito. Efectivo → gasto de caja "Pago a proveedor".
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = PaymentSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const purchase = await db.purchase.findFirst({
      where: { id: params.id, businessId: user.businessId },
      include: { supplier: { select: { name: true } } },
    })
    if (!purchase) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

    const balance = Number(purchase.total) - Number(purchase.paidAmount)
    if (balance <= 0) return badRequest('Esta compra no tiene saldo pendiente')

    // Tope al saldo, como en el prototipo
    const amount = Math.min(Math.round(parsed.data.amount), balance)

    let cashSessionId: string | null = null
    if (parsed.data.method === 'CASH') {
      const cashSession = await findOpenCashSession(db, purchase.branchId, user.id)
      if (!cashSession) {
        return badRequest('No hay caja abierta. Abre un turno antes de abonar en efectivo.')
      }
      cashSessionId = cashSession.id
    }

    const result = await db.$transaction(async (tx) => {
      let cashMovementId: string | null = null
      if (parsed.data.method === 'CASH' && cashSessionId) {
        const movement = await tx.cashMovement.create({
          data: {
            type: CashMovementType.EXPENSE,
            amount,
            description: 'Pago a proveedor',
            comment: purchase.supplier.name,
            cashSessionId,
            createdById: user.id,
          },
        })
        cashMovementId = movement.id
      }

      const payment = await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          amount,
          method: parsed.data.method,
          cashMovementId,
          createdById: user.id,
        },
      })

      // Incremento CONDICIONADO al saldo vigente (no al leído antes de abrir
      // la transacción): dos abonos casi simultáneos por el saldo completo
      // no deben poder sobrepagar la compra ni duplicar el gasto de caja.
      const inc = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "purchases"
        SET "paidAmount" = "paidAmount" + ${amount}
        WHERE "id" = ${purchase.id} AND "paidAmount" + ${amount} <= "total"
        RETURNING "id"
      `
      if (inc.length === 0) {
        throw new BalanceChangedError()
      }
      const updated = await tx.purchase.findUniqueOrThrow({
        where: { id: purchase.id },
        include: { supplier: { select: { id: true, name: true } } },
      })

      return { payment, purchase: updated }
    })

    db.auditLog
      .create({
        data: {
          action: 'PAYMENT',
          entity: 'Purchase',
          entityId: purchase.id,
          payload: { amount, method: parsed.data.method },
          userId: user.id,
        },
      })
      .catch(() => {})

    const newBalance = Number(result.purchase.total) - Number(result.purchase.paidAmount)
    return NextResponse.json(
      {
        payment: serialize(result.payment),
        purchase: { ...serialize(result.purchase), balance: newBalance },
        // Datos para el recibo de abono del prototipo
        receipt: {
          type: 'proveedor',
          name: result.purchase.supplier.name,
          amount,
          method: parsed.data.method,
          balance: newBalance,
          date: result.payment.createdAt,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof BalanceChangedError) {
      return badRequest(error.message)
    }
    return serverError('POST /api/purchases/[id]/payments', error)
  }
}
