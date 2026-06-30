'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/format'

interface CashSession {
  id: string
  openingBalance: number
  openedAt: string
  branch: { id: string; name: string }
  openedBy: { id: string; name: string | null }
}

interface Summary {
  totalSales: number
  cashSales: number
  expenses: number
  withdrawals: number
  expectedBalance: number
}

export default function CloseCashRegisterPage() {
  const router = useRouter()
  const [session, setSession] = useState<CashSession | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [closingBalance, setClosingBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cash-registers/current')
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session ?? null)
        setSummary(data.summary ?? null)
      })
      .catch(() => setError('Error al cargar la sesión de caja'))
      .finally(() => setLoading(false))
  }, [])

  const counted = parseFloat(closingBalance) || 0
  const expected = summary?.expectedBalance ?? 0
  const difference = counted - expected

  function diffColor() {
    if (closingBalance === '') return 'text-gray-500'
    const abs = Math.abs(difference)
    if (abs === 0) return 'text-green-600'
    if (abs <= 50000) return 'text-orange-500'
    return 'text-red-600'
  }

  async function handleClose() {
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/cash-registers/${session.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closingBalance: counted,
          closingNotes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al cerrar la caja')
        setShowConfirm(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔓</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">No hay caja abierta</h2>
          <p className="text-sm text-gray-500 mb-6">No tienes una sesión de caja activa.</p>
          <a
            href="/dashboard/cash-register/open"
            className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            Abrir caja ahora →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">
              🔐
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Cerrar caja</h1>
              <p className="text-sm text-gray-500">{session.branch.name}</p>
            </div>
          </div>
        </div>

        {/* Shift summary */}
        <div className="px-8 py-5 border-b border-gray-100 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Resumen del turno
          </h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Apertura</span>
            <span className="font-medium text-gray-900">{fmt(session.openingBalance)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ventas del turno</span>
            <span className="font-medium text-green-600">+ {fmt(summary?.totalSales ?? 0)}</span>
          </div>
          {(summary?.expenses ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Gastos</span>
              <span className="font-medium text-red-500">− {fmt(summary!.expenses)}</span>
            </div>
          )}
          {(summary?.withdrawals ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Retiros</span>
              <span className="font-medium text-red-500">− {fmt(summary!.withdrawals)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
            <span className="text-gray-700">Saldo esperado</span>
            <span className="text-blue-600">{fmt(expected)}</span>
          </div>
        </div>

        {/* Closing form */}
        <div className="px-8 py-5 space-y-4">
          {/* Counted amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto contado (COP) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                placeholder="0"
                className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Real-time difference */}
          {closingBalance !== '' && (
            <div className={`flex justify-between items-center px-4 py-3 rounded-lg text-sm font-semibold ${
              Math.abs(difference) === 0
                ? 'bg-green-50'
                : Math.abs(difference) <= 50000
                  ? 'bg-orange-50'
                  : 'bg-red-50'
            }`}>
              <span className="text-gray-600">
                {difference > 0 ? 'Sobrante' : difference < 0 ? 'Faltante' : 'Exacto'}
              </span>
              <span className={diffColor()}>
                {difference > 0 ? '+' : ''}{fmt(difference)}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas de cierre <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del turno..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={() => {
              if (!closingBalance) { setError('Ingresa el monto contado'); return }
              setError(null)
              setShowConfirm(true)
            }}
            disabled={submitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
          >
            Cerrar caja
          </button>
        </div>

        <div className="px-8 pb-6">
          <a href="/dashboard" className="block text-center text-sm text-gray-400 hover:text-gray-600">
            ← Volver al inicio
          </a>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="font-bold text-lg text-gray-800">Confirmar cierre</h3>
              <p className="text-sm text-gray-500 mt-1">
                Esta acción cerrará la sesión de caja de <strong>{session.branch.name}</strong>.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Monto contado</span>
                <span className="font-semibold text-gray-900">{fmt(counted)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Diferencia</span>
                <span className={`font-semibold ${diffColor()}`}>
                  {difference > 0 ? '+' : ''}{fmt(difference)}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
