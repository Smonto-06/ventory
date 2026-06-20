'use client'

import { useState, useEffect, useCallback } from 'react'

interface SaleItem {
  id: string
  productId: string
  product: { name: string; sku: string | null }
  quantity: number
  unitPrice: number
  taxRate: number
  subtotal: number
  total: number
}

interface Sale {
  id: string
  folio: string
  status: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  total: number
  paymentMethod: string
  amountPaid: number
  changeGiven: number
  notes: string | null
  createdAt: string
  cashier: { id: string; name: string | null }
  branch: { id: string; name: string }
  items?: SaleItem[]
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

function fmtDate(d: string) {
  return new Date(d).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weekAgoISO() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SalesClient() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'today' | 'week' | 'custom'>('today')
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [selected, setSelected] = useState<Sale | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      let from = dateFrom
      let to = dateTo

      if (filter === 'today') {
        const t = todayISO()
        from = t
        to = t
      } else if (filter === 'week') {
        from = weekAgoISO()
        to = todayISO()
      }

      params.set('dateFrom', `${from}T00:00:00`)
      params.set('dateTo', `${to}T23:59:59`)
      const res = await fetch(`/api/sales?${params}`)
      const data = await res.json()
      setSales(data.sales ?? [])
    } finally {
      setLoading(false)
    }
  }, [filter, dateFrom, dateTo])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  async function openDetail(sale: Sale) {
    if (sale.items) {
      setSelected(sale)
      return
    }
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/sales?dateFrom=${sale.createdAt}&dateTo=${sale.createdAt}`)
      const data = await res.json()
      const full = data.sales?.find((s: Sale) => s.id === sale.id) ?? sale
      setSelected(full)
    } finally {
      setDetailLoading(false)
    }
  }

  const totalAmount = sales.reduce((s, r) => (r.status === 'COMPLETED' ? s + r.total : s), 0)
  const completedCount = sales.filter((s) => s.status === 'COMPLETED').length

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Historial de Ventas</h1>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{fmt(totalAmount)}</p>
          <p className="text-xs text-gray-500">{completedCount} ventas completadas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['today', 'week', 'custom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'today' ? 'Hoy' : f === 'week' ? 'Esta semana' : 'Rango'}
            </button>
          ))}
        </div>
        {filter === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
        ) : sales.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Sin ventas en el período seleccionado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Folio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha / Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cajero</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Método</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{sale.folio}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(sale.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{sale.cashier.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(sale.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        sale.status === 'COMPLETED'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {sale.status === 'COMPLETED' ? 'Completada' : 'Anulada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openDetail(sale)}
                        className="text-xs text-blue-600 hover:underline font-medium"
                        disabled={detailLoading}
                      >
                        Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{selected.folio}</p>
                <p className="text-xs text-gray-500 mt-0.5">{fmtDate(selected.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Sucursal</p>
                  <p className="font-medium text-gray-800">{selected.branch.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cajero</p>
                  <p className="font-medium text-gray-800">{selected.cashier.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Método de pago</p>
                  <p className="font-medium text-gray-800">{PAYMENT_LABELS[selected.paymentMethod] ?? selected.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estado</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                    selected.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {selected.status === 'COMPLETED' ? 'Completada' : 'Anulada'}
                  </span>
                </div>
              </div>

              {selected.items && selected.items.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Productos</p>
                  <div className="space-y-1.5">
                    {selected.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.product.name}
                          <span className="text-gray-400 ml-1">×{item.quantity}</span>
                        </span>
                        <span className="font-medium text-gray-900">{fmt(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{fmt(selected.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>IVA</span><span>{fmt(selected.taxAmount)}</span>
                </div>
                {selected.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento</span><span>-{fmt(selected.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-100">
                  <span>Total</span><span>{fmt(selected.total)}</span>
                </div>
                {selected.paymentMethod === 'CASH' && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>Recibido: {fmt(selected.amountPaid)}</span>
                    <span>Cambio: {fmt(selected.changeGiven)}</span>
                  </div>
                )}
              </div>

              {selected.notes && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{selected.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
