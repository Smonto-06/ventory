import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { calculateCloseBalance } from '@/lib/cash-session'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const session = await db.cashSession.findFirst({
    where: { openedById: user.id, status: 'OPEN' },
    include: {
      branch: { select: { id: true, name: true } },
      openedBy: { select: { id: true, name: true, role: true } },
      sales: {
        where: { status: 'COMPLETED' },
        select: { total: true, paymentMethod: true },
      },
      movements: {
        select: { id: true, type: true, amount: true, description: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ session: null })
  }

  const cashSales = session.sales
    .filter((s) => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + Number(s.total), 0)

  const expenses = session.movements
    .filter((m) => m.type === 'EXPENSE')
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const withdrawals = session.movements
    .filter((m) => m.type === 'WITHDRAWAL')
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const preview = calculateCloseBalance(
    Number(session.openingBalance),
    cashSales,
    expenses,
    withdrawals,
    Number(session.openingBalance) + cashSales - expenses - withdrawals,
  )

  return NextResponse.json({
    session,
    summary: {
      totalSales: session.sales.reduce((s, r) => s + Number(r.total), 0),
      cashSales,
      expenses,
      withdrawals,
      expectedBalance: preview.expectedBalance,
    },
  })
}
