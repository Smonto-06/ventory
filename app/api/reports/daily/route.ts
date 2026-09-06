import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { profitReport, expectedBalance, cashPortion, diaColombiano, diaColombianoDeFecha } from '@/lib/pos'
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

  // El día calendario es el de COLOMBIA (UTC-5), no el del runtime del
  // servidor (Vercel corre en UTC): usar getFullYear/getMonth/getDate
  // locales corría el corte del día 5 horas, y una venta después de las
  // 7 p.m. Colombia aparecía en el reporte del día SIGUIENTE.
  const { desde: startOfDay, hasta: endOfDay } = dateParam
    ? diaColombianoDeFecha(dateParam)
    : diaColombiano(new Date())

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
      select: { type: true, amount: true, cashSessionId: true },
    }),

    // La caja "activa" es la de ESTE usuario (caja por usuario): con más de
    // un cajero abierto a la vez en el negocio, tomar "la más reciente de
    // cualquiera" mezclaba la apertura/ventas de un cajero con los
    // ingresos/gastos de otro en un esperado que no correspondía a ningún
    // cajón físico real.
    db.cashSession.findFirst({
      where: { branch: { businessId }, status: 'OPEN', openedById: session.user.id },
      include: {
        sales: {
          where: { status: 'COMPLETED' },
          select: { total: true, paymentMethod: true, payments: { select: { method: true, amount: true } } },
        },
      },
    }),
  ])

  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0)
  const transactionCount = sales.length
  const totalItems = sales.reduce(
    (sum, s) => sum + s.items.reduce((a, i) => a + Number(i.quantity), 0),
    0,
  )

  // Ventas por hora (0-23), en hora Colombia (UTC-5) — getHours() usaría la
  // hora local del servidor (UTC en Vercel), desfasando el gráfico 5 horas.
  const hourMap = new Map<number, { total: number; count: number }>()
  for (const sale of sales) {
    const hour = (sale.createdAt.getUTCHours() + 24 - 5) % 24
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

  // Utilidad: ventas − costo de lo vendido, NETAS de lo devuelto — un
  // artículo que volvió no se vendió de verdad, ni su costo ni su ingreso
  // deberían contar. returnedQty ya trae el acumulado de devoluciones de
  // cada línea; se descuenta con la misma fórmula proporcional (redondeada
  // una vez) que usa return/route.ts para que ambos cálculos coincidan.
  const netSalesTotal = sales.reduce(
    (sum, s) =>
      sum +
      s.items.reduce((a, i) => {
        const qty = Number(i.quantity)
        const kept = qty - Number(i.returnedQty)
        if (kept <= 0) return a
        return a + (kept >= qty ? Number(i.total) : Math.round((Number(i.total) * kept) / qty))
      }, 0),
    0,
  )
  const costOfGoods = sales.reduce(
    (sum, s) =>
      sum +
      s.items.reduce((a, i) => {
        const kept = Number(i.quantity) - Number(i.returnedQty)
        return a + Number(i.costPrice ?? 0) * Math.max(0, kept)
      }, 0),
    0,
  )
  // Gastos operativos del día completo (todos los turnos/cajeros) — es lo
  // que resta en la utilidad neta del negocio, sin importar en qué cajón.
  const expenses = movements
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const profit = profitReport(netSalesTotal, costOfGoods, expenses)

  const openingBalance = activeCashSession ? Number(activeCashSession.openingBalance) : 0
  // Solo el efectivo entra al cajón: el esperado debe coincidir con el que
  // muestran la pantalla de cierre y /api/cash-registers/current. Ingresos y
  // gastos aquí sí se acotan a ESTE turno (no todo el día): son los que
  // realmente pasaron por este cajón físico.
  const shiftCashSales = activeCashSession
    ? activeCashSession.sales.reduce((sum, s) => sum + cashPortion({ ...s, total: Number(s.total) }), 0)
    : 0
  const sessionMovements = activeCashSession
    ? movements.filter((m) => m.cashSessionId === activeCashSession.id)
    : []
  const sessionIncomes = sessionMovements
    .filter((m) => m.type === 'INCOME')
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const sessionExpenses = sessionMovements
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((sum, m) => sum + Number(m.amount), 0)

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
      sales: netSalesTotal,
      costOfGoods,
      gross: profit.gross,
      marginPct: profit.marginPct,
      expenses,
      net: profit.net,
    },
    cashSummary: {
      openingBalance,
      totalSales,
      incomes: sessionIncomes,
      expenses: sessionExpenses,
      cashSales: shiftCashSales,
      expectedBalance: activeCashSession
        ? expectedBalance(openingBalance, shiftCashSales, sessionIncomes, sessionExpenses)
        : 0,
      transactionCount,
    },
  })
}
