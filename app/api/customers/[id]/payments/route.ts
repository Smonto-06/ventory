import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import {
  unauthorized,
  badRequest,
  serverError,
  findOpenCashSession,
  resolveBranchId,
  serialize,
} from '@/lib/api-helpers'
import { CashMovementType } from '@prisma/client'

export const dynamic = 'force-dynamic'

/** Otro abono concurrente ya redujo el saldo por debajo de lo que este abono necesitaba */
class BalanceChangedError extends Error {
  constructor() {
    super('El saldo del cliente cambió por otra operación simultánea. Vuelve a intentar el abono.')
    this.name = 'BalanceChangedError'
  }
}

const PaymentSchema = z.object({
  amount: z.number().positive('El abono debe ser mayor a 0'),
  method: z.enum(['CASH', 'CARD', 'TRANSFER']).default('CASH'),
  branchId: z.string().optional(),
})

// Abono de cliente: descuenta su saldo de crédito.
// Si es en efectivo genera movimiento de caja ingreso "Abono de cliente" y emite recibo.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = PaymentSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const customer = await db.customer.findFirst({
      where: { id: params.id, businessId: user.businessId },
    })
    if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const balance = Number(customer.balance)
    if (balance <= 0) return badRequest('El cliente no tiene saldo pendiente')

    // Tope al saldo, como en el prototipo
    const amount = Math.min(Math.round(parsed.data.amount), balance)

    let cashSessionId: string | null = null
    if (parsed.data.method === 'CASH') {
      const branchId = await resolveBranchId(user.businessId, parsed.data.branchId)
      if (!branchId) return badRequest('Sucursal no encontrada')
      const cashSession = await findOpenCashSession(db, branchId, user.id)
      if (!cashSession) {
        return badRequest('No hay caja abierta. Abre un turno antes de recibir abonos en efectivo.')
      }
      cashSessionId = cashSession.id
    }

    const result = await db.$transaction(async (tx) => {
      let cashMovementId: string | null = null
      if (parsed.data.method === 'CASH' && cashSessionId) {
        const movement = await tx.cashMovement.create({
          data: {
            type: CashMovementType.INCOME,
            amount,
            description: 'Abono de cliente',
            comment: customer.name,
            cashSessionId,
            createdById: user.id,
          },
        })
        cashMovementId = movement.id
      }

      // Decremento CONDICIONADO al saldo vigente (no al leído antes de abrir
      // la transacción): dos abonos casi simultáneos por el saldo completo
      // no deben poder dejarlo negativo ni duplicar el ingreso de caja.
      const dec = await tx.customer.updateMany({
        where: { id: customer.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (dec.count === 0) {
        throw new BalanceChangedError()
      }
      const updated = await tx.customer.findUniqueOrThrow({ where: { id: customer.id } })

      const payment = await tx.customerPayment.create({
        data: {
          customerId: customer.id,
          amount,
          method: parsed.data.method,
          balanceAfter: Number(updated.balance),
          cashMovementId,
          createdById: user.id,
        },
      })

      return { payment, customer: updated }
    })

    db.auditLog
      .create({
        data: {
          action: 'PAYMENT',
          entity: 'Customer',
          entityId: customer.id,
          payload: { amount, method: parsed.data.method },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json(
      {
        payment: serialize(result.payment),
        customer: serialize(result.customer),
        // Datos para el recibo de abono del prototipo
        receipt: {
          type: 'cliente',
          name: customer.name,
          amount,
          method: parsed.data.method,
          balance: Number(result.customer.balance),
          date: result.payment.createdAt,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof BalanceChangedError) {
      return badRequest(error.message)
    }
    return serverError('POST /api/customers/[id]/payments', error)
  }
}
