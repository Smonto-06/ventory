import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { profitReport } from '@/lib/pos'
import { isAdmin } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/get-session'

export const dynamic = 'force-dynamic'

// Reporte por rango de fechas con comparativa contra el período anterior
// de la misma duración. GET /api/reports/range?from=YYYY-MM-DD&to=YYYY-MM-DD

interface PeriodStats {
  totalSales: number
  /** ventas netas de lo devuelto — es la que entra a la utilidad, no al total mostrado */
  netSales: number
  transactionCount: number
  totalItems: number
  costOfGoods: number
  expenses: number
}

async function periodStats(businessId: string, from: Date, to: Date): Promise<PeriodStats> {
  const [sales, movements] = await Promise.all([
    db.sale.findMany({
      where: { branch: { businessId }, status: 'COMPLETED', createdAt: { gte: from, lt: to } },
      include: { items: { select: { total: true, quantity: true, costPrice: true, returnedQty: true } } },
    }),
    db.cashMovement.findMany({
      where: {
        cashSession: { branch: { businessId } },
        type: { in: ['EXPENSE', 'WITHDRAWAL'] },
        createdAt: { gte: from, lt: to },
      },
      select: { amount: true },
    }),
  ])
  // Utilidad NETA de lo devuelto: un artículo que volvió no se vendió de
  // verdad, ni su costo ni su ingreso deberían contar (misma fórmula
  // proporcional redondeada una vez que usa return/route.ts).
  const netSales = sales.reduce(
    (s, v) =>
      s +
      v.items.reduce((a, i) => {
        const qty = Number(i.quantity)
        const kept = qty - Number(i.returnedQty)
        if (kept <= 0) return a
        return a + (kept >= qty ? Number(i.total) : Math.round((Number(i.total) * kept) / qty))
      }, 0),
    0,
  )
  const costOfGoods = sales.reduce(
    (s, v) =>
      s +
      v.items.reduce((a, i) => {
        const kept = Number(i.quantity) - Number(i.returnedQty)
        return a + Number(i.costPrice ?? 0) * Math.max(0, kept)
      }, 0),
    0,
  )
  return {
    totalSales: sales.reduce((s, v) => s + Number(v.total), 0),
    netSales,
    transactionCount: sales.length,
    totalItems: sales.reduce((s, v) => s + v.items.reduce((a, i) => a + Number(i.quantity), 0), 0),
    costOfGoods,
    expenses: movements.reduce((s, m) => s + Number(m.amount), 0),
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isAdmin(session.user as unknown as SessionUser)) {
    return NextResponse.json({ error: 'No tienes permiso para ver reportes' }, { status: 403 })
  }
  const businessId = session.user.businessId

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  if (!fromParam || !toParam) {
    return NextResponse.json({ error: 'Parámetros from y to requeridos (YYYY-MM-DD)' }, { status: 400 })
  }
  const from = new Date(`${fromParam}T00:00:00`)
  const toIncl = new Date(`${toParam}T00:00:00`)
  if (isNaN(from.getTime()) || isNaN(toIncl.getTime()) || toIncl < from) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
  }
  const DAY = 24 * 60 * 60 * 1000
  const to = new Date(toIncl.getTime() + DAY) // fin exclusivo
  const days = Math.round((to.getTime() - from.getTime()) / DAY)
  if (days > 366) {
    return NextResponse.json({ error: 'El rango máximo es de un año' }, { status: 400 })
  }

  // Período actual (detallado) + período anterior (solo totales, para comparar)
  const prevFrom = new Date(from.getTime() - days * DAY)

  const [sales, current, previous] = await Promise.all([
    db.sale.findMany({
      where: { branch: { businessId }, status: 'COMPLETED', createdAt: { gte: from, lt: to } },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        payments: { select: { method: true, amount: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    periodStats(businessId, from, to),
    periodStats(businessId, prevFrom, from),
  ])

  // Ventas por día (para la gráfica)
  const byDayMap = new Map<string, { total: number; count: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * DAY)
    byDayMap.set(d.toISOString().slice(0, 10), { total: 0, count: 0 })
  }
  for (const v of sales) {
    const local = new Date(v.createdAt.getTime())
    const key = new Date(local.getFullYear(), local.getMonth(), local.getDate()).toISOString().slice(0, 10)
    const e = byDayMap.get(key)
    if (e) {
      e.total += Number(v.total)
      e.count += 1
    }
  }
  const salesByDay = Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v }))

  // Por método (usa el split de pagos combinados)
  const byPaymentMethod: Record<string, number> = {}
  for (const v of sales) {
    if (v.payments.length > 0) {
      for (const p of v.payments) byPaymentMethod[p.method] = (byPaymentMethod[p.method] ?? 0) + Number(p.amount)
    } else {
      byPaymentMethod[v.paymentMethod] = (byPaymentMethod[v.paymentMethod] ?? 0) + Number(v.total)
    }
  }

  // Top productos por ingreso
  const prodMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const v of sales) {
    for (const it of v.items) {
      const e = prodMap.get(it.product.id) ?? { name: it.product.name, quantity: 0, revenue: 0 }
      e.quantity += Number(it.quantity)
      e.revenue += Number(it.total)
      prodMap.set(it.product.id, e)
    }
  }
  const topProducts = Array.from(prodMap.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const profit = profitReport(current.netSales, current.costOfGoods, current.expenses)
  const prevProfit = profitReport(previous.netSales, previous.costOfGoods, previous.expenses)

  const pct = (now: number, before: number) =>
    before === 0 ? null : Math.round(((now - before) / before) * 1000) / 10

  return NextResponse.json({
    from: fromParam,
    to: toParam,
    days,
    summary: {
      totalSales: current.totalSales,
      transactionCount: current.transactionCount,
      averageSale: current.transactionCount ? Math.round(current.totalSales / current.transactionCount) : 0,
      totalItems: current.totalItems,
    },
    salesByDay,
    byPaymentMethod,
    topProducts,
    profit,
    comparison: {
      prevTotalSales: previous.totalSales,
      prevTransactionCount: previous.transactionCount,
      prevNet: prevProfit.net,
      salesChangePct: pct(current.totalSales, previous.totalSales),
      countChangePct: pct(current.transactionCount, previous.transactionCount),
      netChangePct: pct(profit.net, prevProfit.net),
    },
  })
}
