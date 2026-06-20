import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

function fmt(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

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
        sales: { where: { status: 'COMPLETED' }, select: { total: true } },
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
      take: 5,
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

  const todayTotal = Number(todaySalesAgg._sum.total ?? 0)
  const todayCount = todaySalesAgg._count.id
  const cashTotal = activeCashSession
    ? activeCashSession.sales.reduce((s, r) => s + Number(r.total), 0)
    : 0
  const openingBalance = activeCashSession ? Number(activeCashSession.openingBalance) : 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Panel Principal</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {now.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ventas del día</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(todayTotal)}</p>
          <p className="text-sm text-gray-500 mt-1">{todayCount} transacciones</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Estado de caja</p>
          {activeCashSession ? (
            <>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                <p className="text-sm font-semibold text-green-700">Abierta — {activeCashSession.branch.name}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Apertura: {fmt(openingBalance)} · Total esperado: {fmt(openingBalance + cashTotal)}
              </p>
              <a
                href="/dashboard/cash-register/close"
                className="inline-block mt-2 text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
              >
                Cerrar caja →
              </a>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                <p className="text-sm font-semibold text-gray-600">Cerrada</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">No hay caja activa</p>
              <a
                href="/dashboard/cash-register/open"
                className="inline-block mt-2 text-xs font-medium text-green-600 hover:text-green-700 hover:underline"
              >
                Abrir caja →
              </a>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stock bajo</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{lowStockItems.length}</p>
          <p className="text-sm text-gray-500 mt-1">productos con stock mínimo</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <a
          href="/dashboard/pos"
          className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 transition-colors"
        >
          <span className="text-xl">🛒</span>
          <span className="font-semibold text-sm">Ir al POS</span>
        </a>
        {activeCashSession ? (
          <a
            href="/dashboard/cash-register/close"
            className="flex items-center gap-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-4 py-3 transition-colors"
          >
            <span className="text-xl">🔐</span>
            <span className="font-semibold text-sm text-red-700">Cerrar caja</span>
          </a>
        ) : (
          <a
            href="/dashboard/cash-register/open"
            className="flex items-center gap-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl px-4 py-3 transition-colors"
          >
            <span className="text-xl">🏦</span>
            <span className="font-semibold text-sm text-green-700">Abrir caja</span>
          </a>
        )}
        <a
          href="/dashboard/products"
          className="flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 transition-colors"
        >
          <span className="text-xl">📦</span>
          <span className="font-semibold text-sm text-gray-700">Ver productos</span>
        </a>
        <a
          href="/dashboard/reports"
          className="flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 transition-colors"
        >
          <span className="text-xl">📊</span>
          <span className="font-semibold text-sm text-gray-700">Ver reporte</span>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Últimas ventas del día</h2>
            <a href="/dashboard/sales" className="text-xs text-blue-600 hover:underline">Ver todas →</a>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin ventas hoy</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{sale.folio}</p>
                    <p className="text-xs text-gray-500">
                      {fmtTime(sale.createdAt)} · {PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmt(Number(sale.total))}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      sale.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {sale.status === 'COMPLETED' ? 'Completada' : 'Anulada'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Productos con stock bajo</h2>
            <a href="/dashboard/products" className="text-xs text-blue-600 hover:underline">Ver todos →</a>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin alertas de stock</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.product.sku && `SKU: ${item.product.sku} · `}{item.branch.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                      {item.quantity} / {item.minStock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
