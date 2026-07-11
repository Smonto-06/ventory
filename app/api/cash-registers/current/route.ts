import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { expectedBalance } from '@/lib/pos'
import { serialize } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

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
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          comment: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ session: null })
  }

  // Regla del prototipo: esperado = apertura + ventas del turno + ingresos − gastos
  const salesTotal = session.sales.reduce((sum, s) => sum + Number(s.total), 0)
  const cashSales = session.sales
    .filter((s) => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + Number(s.total), 0)
  const incomes = session.movements
    .filter((m) => m.type === 'INCOME')
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const expenses = session.movements
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((sum, m) => sum + Number(m.amount), 0)

  return NextResponse.json({
    session: serialize(session),
    summary: {
      totalSales: salesTotal,
      cashSales,
      incomes,
      expenses,
      expectedBalance: expectedBalance(Number(session.openingBalance), salesTotal, incomes, expenses),
    },
  })
}
