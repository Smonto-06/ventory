'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Branch {
  id: string
  name: string
}

export default function OpenCashRegisterPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [branchId, setBranchId] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [terminal, setTerminal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/branches')
      .then((r) => r.json())
      .then((data) => {
        const list: Branch[] = data.branches ?? []
        setBranches(list)
        if (list.length === 1) setBranchId(list[0].id)
      })
      .catch(() => setError('Error al cargar sucursales'))
      .finally(() => setLoadingBranches(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!branchId) { setError('Selecciona una sucursal'); return }
    const balance = parseFloat(openingBalance) || 0
    if (balance < 0) { setError('El monto inicial no puede ser negativo'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/cash-registers/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          openingBalance: balance,
          terminal: terminal.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setError('Ya tienes una caja abierta en este turno. Ciérrala antes de abrir una nueva.')
        } else {
          setError(data.error ?? 'Error al abrir la caja')
        }
        return
      }
      router.push('/dashboard/pos')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">
            🏦
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Abrir caja</h1>
            <p className="text-sm text-gray-500">Ingresa los datos del turno</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sucursal <span className="text-red-500">*</span>
            </label>
            {loadingBranches ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : branches.length === 0 ? (
              <p className="text-sm text-red-500">No hay sucursales activas</p>
            ) : branches.length === 1 ? (
              <div className="h-10 px-3 flex items-center bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                {branches[0].name}
              </div>
            ) : (
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Seleccionar sucursal...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Opening balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto inicial (COP)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Dinero en efectivo al inicio del turno</p>
          </div>

          {/* Terminal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terminal <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={terminal}
              onChange={(e) => setTerminal(e.target.value)}
              placeholder="Ej: Caja 1, Terminal A..."
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loadingBranches || branches.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
          >
            {submitting ? 'Abriendo caja...' : 'Abrir caja'}
          </button>
        </form>

        <a
          href="/dashboard"
          className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-4"
        >
          ← Volver al inicio
        </a>
      </div>
    </div>
  )
}
