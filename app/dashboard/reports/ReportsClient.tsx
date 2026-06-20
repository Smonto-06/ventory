'use client'

import { useState, useEffect } from 'react'

interface HourData { hour: number; total: number; count: number }
interface TopProduct { name: string; quantity: number; revenue: number }
interface CashSummary { openingBalance: number; totalSales: number; expectedBalance: number; transactionCount: number }

interface ReportData {
  salesByHour: HourData[]
  byPaymentMethod: Record<string, number>
  topProducts: TopProduct[]
  cashSummary: CashSummary
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReportsClient() {
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/daily?date=${date}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [date])

  const activeHours = data?.salesByHour.filter((h) => h.total > 0) ?? []
  const maxHourTotal = Math.max(...(activeHours.map((h) => h.total)), 1)
  const totalByMethod = data ? Object.values(data.byPaymentMethod).reduce((s, v) => s + v, 0) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reporte Diario</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">Cargando reporte...</div>
      ) : !data ? (
        <div className="py-24 text-center text-sm text-gray-400">Error al cargar el reporte</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total ventas</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(data.cashSummary.totalSales)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Transacciones</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.cashSummary.transactionCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Apertura caja</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(data.cashSummary.openingBalance)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Saldo esperado</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(data.cashSummary.expectedBalance)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Hour */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Ventas por hora</h2>
              {activeHours.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin ventas en este día</p>
              ) : (
                <div className="space-y-2">
                  {data.salesByHour
                    .filter((h) => h.total > 0)
                    .map((h) => (
                      <div key={h.hour} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-10 shrink-0">
                          {String(h.hour).padStart(2, '0')}:00
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(h.total / maxHourTotal) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-20 text-right shrink-0">
                          {fmt(h.total)}
                        </span>
                        <span className="text-xs text-gray-400 w-6 shrink-0">{h.count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* By Payment Method */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Por método de pago</h2>
              {Object.keys(data.byPaymentMethod).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin ventas en este día</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.byPaymentMethod)
                    .sort(([, a], [, b]) => b - a)
                    .map(([method, amount]) => {
                      const pct = totalByMethod > 0 ? (amount / totalByMethod) * 100 : 0
                      return (
                        <div key={method}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{PAYMENT_LABELS[method] ?? method}</span>
                            <span className="text-gray-900 font-semibold">{fmt(amount)}</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% del total</p>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Top 5 Products */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Top 5 productos</h2>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin ventas en este día</p>
              ) : (
                <div className="space-y-2">
                  {data.topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 py-1.5">
                      <span className="text-sm font-bold text-gray-300 w-5 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.quantity} unidades</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 shrink-0">{fmt(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cash Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Resumen de caja</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Apertura</span>
                  <span className="font-medium text-gray-900">{fmt(data.cashSummary.openingBalance)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Ventas del día</span>
                  <span className="font-medium text-green-700">+{fmt(data.cashSummary.totalSales)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-semibold text-gray-800">Saldo esperado</span>
                  <span className="font-bold text-gray-900 text-base">{fmt(data.cashSummary.expectedBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
