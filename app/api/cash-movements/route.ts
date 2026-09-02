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
  resolveBranchId,
  serialize,
} from '@/lib/api-helpers'
import { CashMovementType } from '@prisma/client'
import { CASH_MOVEMENT_DESCRIPTIONS } from '@/lib/pos'

export const dynamic = 'force-dynamic'

const CreateMovementSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().trim().min(1, 'Selecciona la descripción del movimiento'),
  comment: z.string().trim().optional(),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  branchId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('cashSessionId')

  let cashSessionId = sessionId
  if (!cashSessionId) {
    const branchId = await resolveBranchId(user.businessId, searchParams.get('branchId'))
    if (!branchId) return badRequest('Sucursal no encontrada')
    const open = await findOpenCashSession(db, branchId, user.id)
    if (!open) return NextResponse.json({ movements: [], descriptions: CASH_MOVEMENT_DESCRIPTIONS })
    cashSessionId = open.id
  }

  const movements = await db.cashMovement.findMany({
    where: { cashSessionId, cashSession: { branch: { businessId: user.businessId } } },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    movements: serialize(movements),
    descriptions: CASH_MOVEMENT_DESCRIPTIONS,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = CreateMovementSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const branchId = await resolveBranchId(user.businessId, parsed.data.branchId)
    if (!branchId) return badRequest('Sucursal no encontrada')

    const cashSession = await findOpenCashSession(db, branchId, user.id)
    if (!cashSession) {
      return badRequest('No hay caja abierta. Abre un turno antes de registrar movimientos.')
    }

    const movement = await db.cashMovement.create({
      data: {
        type: parsed.data.type as CashMovementType,
        amount: Math.round(parsed.data.amount),
        description: parsed.data.description,
        comment: parsed.data.comment || null,
        cashSessionId: cashSession.id,
        createdById: user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entity: 'CashMovement',
          entityId: movement.id,
          payload: { type: parsed.data.type, amount: Math.round(parsed.data.amount), description: parsed.data.description },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ movement: serialize(movement) }, { status: 201 })
  } catch (error) {
    return serverError('POST /api/cash-movements', error)
  }
}
