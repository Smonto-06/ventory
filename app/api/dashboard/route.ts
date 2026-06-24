import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const businessId = session.user.businessId
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const [todaySalesAgg, activeCashSession, lowStockItems, recentSales] = await Promise.all([
    db.sale.aggregate({
      where: {
        branch: { businessId },
        status: 'COMPLETED',
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      _sum: { total: true },
      _count: { id: true },
    }),

    db.cashSession.findFirst({
      where: { branch: { businessId }, status: 'OPEN' },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    }),

    db.inventory.findMany({
      where: { lowStock: true, product: { businessId, status: 'ACTIVE' } },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { quantity: 'asc' },
      take: 10,
    }),

    db.sale.findMany({
      where: {
        branch: { businessId },
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        cashier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return NextResponse.json({
    todaySales: {
      total: Number(todaySalesAgg._sum.total ?? 0),
      count: todaySalesAgg._count.id,
    },
    activeCashSession: activeCashSession
      ? { ...activeCashSession, openingBalance: Number(activeCashSession.openingBalance) }
      : null,
    lowStockItems,
    recentSales: recentSales.map((s) => ({
      ...s,
      total: Number(s.total),
      subtotal: Number(s.subtotal),
      taxAmount: Number(s.taxAmount),
      discountAmount: Number(s.discountAmount),
      amountPaid: Number(s.amountPaid),
      changeGiven: Number(s.changeGiven),
    })),
  })
}
