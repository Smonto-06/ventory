import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { profitReport, expectedBalance } from '@/lib/pos'
import { isAdmin } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/get-session'

export const dynamic = 'force-dynamic'

// Reporte por fecha calendario (regla 12 del prototipo): total, transacciones,
// venta promedio, arts/venta, ventas por hora, por método, top 5 productos y
// utilidad (ventas − costo de lo vendido, margen %, − gastos = neta).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Los reportes son de administrador (el cajero no ve Reportes ni costos)
  if (!isAdmin(session.user as unknown as SessionUser)) {
    return NextResponse.json({ error: 'No tienes permiso para ver reportes' }, { status: 403 })
  }

  const businessId = session.user.businessId
  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')

  const targetDate = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const [sales, movements, activeCashSession] = await Promise.all([
    // Las ventas anuladas se excluyen de totales y reportes
    db.sale.findMany({
      where: {
        branch: { businessId },
        status: 'COMPLETED',
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    }),

    db.cashMovement.findMany({
      where: {
        cashSession: { branch: { businessId } },
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      select: { type: true, amount: true },
    }),

    db.cashSession.findFirst({
      where: { branch: { businessId }, status: 'OPEN' },
      include: { sales: { where: { status: 'COMPLETED' }, select: { total: true } } },
      orderBy: { openedAt: 'desc' },
    }),
  ])

  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0)
  const transactionCount = sales.length
  const totalItems = sales.reduce(
    (sum, s) => sum + s.items.reduce((a, i) => a + Number(i.quantity), 0),
    0,
  )

  // Ventas por hora (0-23)
  const hourMap = new Map<number, { total: number; count: number }>()
  for (const sale of sales) {
    const hour = sale.createdAt.getHours()
    const existing = hourMap.get(hour) ?? { total: 0, count: 0 }
    hourMap.set(hour, { total: existing.total + Number(sale.total), count: existing.count + 1 })
  }
  const salesByHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: hourMap.get(h)?.total ?? 0,
    count: hourMap.get(h)?.count ?? 0,
  }))

  // Por método de pago (con desglose real del cobro combinado)
  const byPaymentMethod: Record<string, number> = {}
  for (const sale of sales) {
    if (sale.payments.length > 0) {
      for (const p of sale.payments) {
        byPaymentMethod[p.method] = (byPaymentMethod[p.method] ?? 0) + Number(p.amount)
      }
    } else {
      byPaymentMethod[sale.paymentMethod] =
        (byPaymentMethod[sale.paymentMethod] ?? 0) + Number(sale.total)
    }
  }

  // Top 5 productos por cantidad vendida
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = productMap.get(item.productId) ?? {
        name: item.product.name,
        quantity: 0,
        revenue: 0,
      }
      productMap.set(item.productId, {
        name: item.product.name,
        quantity: existing.quantity + Number(item.quantity),
        revenue: existing.revenue + Number(item.total),
      })
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([productId, p]) => ({ productId, ...p }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  // Utilidad: ventas − costo de lo vendido (snapshot costPrice); neta = utilidad − gastos
  const costOfGoods = sales.reduce(
    (sum, s) =>
      sum + s.items.reduce((a, i) => a + Number(i.costPrice ?? 0) * Number(i.quantity), 0),
    0,
  )
  const incomes = movements
    .filter((m) => m.type === 'INCOME')
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const expenses = movements
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const profit = profitReport(totalSales, costOfGoods, expenses)

  const openingBalance = activeCashSession ? Number(activeCashSession.openingBalance) : 0
  const shiftSales = activeCashSession
    ? activeCashSession.sales.reduce((sum, s) => sum + Number(s.total), 0)
    : 0

  return NextResponse.json({
    date: startOfDay.toISOString().slice(0, 10),
    salesByHour,
    byPaymentMethod,
    topProducts,
    summary: {
      totalSales,
      transactionCount,
      averageSale: transactionCount ? Math.round(totalSales / transactionCount) : 0,
      itemsPerSale: transactionCount ? Number((totalItems / transactionCount).toFixed(1)) : 0,
      totalItems,
    },
    profit: {
      sales: totalSales,
      costOfGoods,
      gross: profit.gross,
      marginPct: profit.marginPct,
      expenses,
      net: profit.net,
    },
    cashSummary: {
      openingBalance,
      totalSales,
      incomes,
      expenses,
      expectedBalance: activeCashSession
        ? expectedBalance(openingBalance, shiftSales, incomes, expenses)
        : 0,
      transactionCount,
    },
  })
}
