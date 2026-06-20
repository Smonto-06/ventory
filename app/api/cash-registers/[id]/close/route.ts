import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { calculateCloseBalance, requiresObservation } from '@/lib/cash-session'

const closeSchema = z.object({
  closingBalance: z.number().min(0, 'El monto contado no puede ser negativo'),
  closingNotes: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const session = await db.cashSession.findFirst({
    where: { id: params.id, status: 'OPEN' },
    include: {
      sales: { where: { status: 'COMPLETED' }, select: { total: true, paymentMethod: true } },
      movements: { select: { type: true, amount: true } },
      openedBy: { select: { id: true, businessId: true } },
    },
  })

  if (!session) {
    return NextResponse.json(
      { error: 'Sesión de caja no encontrada o ya está cerrada' },
      { status: 404 },
    )
  }

  // Only the opener or an ADMIN/SUPERVISOR in the same business can close
  const isSameBusiness = session.openedBy.businessId === user.businessId
  const isOwnerOrSuperior =
    session.openedById === user.id ||
    user.role === 'ADMIN' ||
    user.role === 'SUPERVISOR'

  if (!isSameBusiness || !isOwnerOrSuperior) {
    return NextResponse.json({ error: 'No tienes permiso para cerrar esta caja' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const parsed = closeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { closingBalance, closingNotes } = parsed.data

  const cashSales = session.sales
    .filter((s) => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + Number(s.total), 0)

  const expenses = session.movements
    .filter((m) => m.type === 'EXPENSE')
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const withdrawals = session.movements
    .filter((m) => m.type === 'WITHDRAWAL')
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const calc = calculateCloseBalance(
    Number(session.openingBalance),
    cashSales,
    expenses,
    withdrawals,
    closingBalance,
  )

  if (requiresObservation(calc.difference) && !closingNotes) {
    return NextResponse.json(
      {
        error: `Diferencia de ${calc.difference.toFixed(2)} COP supera el umbral. Observaciones obligatorias al cierre.`,
        expectedBalance: calc.expectedBalance,
        difference: calc.difference,
      },
      { status: 422 },
    )
  }

  const closed = await db.cashSession.update({
    where: { id: params.id },
    data: {
      status: 'CLOSED',
      closingBalance,
      expectedBalance: calc.expectedBalance,
      difference: calc.difference,
      closingNotes,
      closedAt: new Date(),
      closedById: user.id,
    },
    include: {
      branch: { select: { id: true, name: true } },
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    session: closed,
    summary: {
      openingBalance: calc.openingBalance,
      cashSales: calc.cashSales,
      expenses: calc.expenses,
      withdrawals: calc.withdrawals,
      expectedBalance: calc.expectedBalance,
      closingBalance: calc.closingBalance,
      difference: calc.difference,
      status: calc.difference > 0 ? 'sobrante' : calc.difference < 0 ? 'faltante' : 'exacto',
    },
  })
}
