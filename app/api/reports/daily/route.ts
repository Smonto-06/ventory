import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const businessId = session.user.businessId
  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')

  const targetDate = dateParam ? new Date(dateParam) : new Date()
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const [sales, activeCashSession] = await Promise.all([
    db.sale.findMany({
      where: {
        branch: { businessId },
        status: 'COMPLETED',
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),

    db.cashSession.findFirst({
      where: { branch: { businessId }, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    }),
  ])

  // Sales by hour (0-23)
  const hourMap = new Map<number, { total: number; count: number }>()
  for (const sale of sales) {
    const hour = sale.createdAt.getHours()
    const existing = hourMap.get(hour) ?? { total: 0, count: 0 }
    hourMap.set(hour, {
      total: existing.total + Number(sale.total),
      count: existing.count + 1,
    })
  }
  const salesByHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: hourMap.get(h)?.total ?? 0,
    count: hourMap.get(h)?.count ?? 0,
  }))

  // By payment method
  const byPaymentMethod: Record<string, number> = {}
  for (const sale of sales) {
    const m = sale.paymentMethod
    byPaymentMethod[m] = (byPaymentMethod[m] ?? 0) + Number(sale.total)
  }

  // Top 5 products by revenue
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const id = item.productId
      const existing = productMap.get(id) ?? { name: item.product.name, quantity: 0, revenue: 0 }
      productMap.set(id, {
        name: item.product.name,
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + Number(item.total),
      })
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Cash summary
  const totalSales = sales.reduce((s, r) => s + Number(r.total), 0)
  const openingBalance = activeCashSession ? Number(activeCashSession.openingBalance) : 0
  const cashSummary = {
    openingBalance,
    totalSales,
    expectedBalance: openingBalance + totalSales,
    transactionCount: sales.length,
  }

  return NextResponse.json({ salesByHour, byPaymentMethod, topProducts, cashSummary })
}
