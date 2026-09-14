import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, serialize } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// Historial de turnos (cierres de caja) con el resumen del prototipo:
// apertura, ventas, ingresos, gastos, esperado, contado, diferencia, fecha, cajero
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const take = Math.min(Number(searchParams.get('take') ?? 50), 200)

  const sessions = await db.cashSession.findMany({
    where: { branch: { businessId: user.businessId }, status: 'CLOSED' },
    include: {
      branch: { select: { id: true, name: true } },
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      sales: { where: { status: 'COMPLETED' }, select: { total: true } },
      movements: { select: { type: true, amount: true } },
    },
    orderBy: { closedAt: 'desc' },
    take,
  })

  const shifts = sessions.map((s) => {
    // Se prefiere el total CONGELADO al cerrar (salesTotal/incomesTotal/
    // expensesTotal): si una venta de este turno se anula después del
    // cierre, recalcular en vivo la "escondería" del total mientras el
    // resto del resumen (esperado, contado, diferencia) sigue mostrando el
    // valor de cuando se cerró — un cierre que ya no cuadra consigo mismo.
    // Turnos cerrados ANTES de esta migración no tienen el valor congelado
    // (columna null): se recalcula en vivo para esos, como antes.
    const salesTotal = s.salesTotal !== null ? Number(s.salesTotal) : s.sales.reduce((sum, v) => sum + Number(v.total), 0)
    const incomes =
      s.incomesTotal !== null
        ? Number(s.incomesTotal)
        : s.movements.filter((m) => m.type === 'INCOME').reduce((sum, m) => sum + Number(m.amount), 0)
    const expenses =
      s.expensesTotal !== null
        ? Number(s.expensesTotal)
        : s.movements
            .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
            .reduce((sum, m) => sum + Number(m.amount), 0)
    return {
      id: s.id,
      branch: s.branch,
      openedBy: s.openedBy,
      closedBy: s.closedBy,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingBalance: Number(s.openingBalance),
      salesTotal,
      incomes,
      expenses,
      expectedBalance: Number(s.expectedBalance ?? 0),
      countedBalance: Number(s.closingBalance ?? 0),
      difference: Number(s.difference ?? 0),
      closingNotes: s.closingNotes,
    }
  })

  return NextResponse.json({ shifts: serialize(shifts) })
}
