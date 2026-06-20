'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  price: number
  taxRate: number
  imageUrl: string | null
  category: string | null
  stock: number | null
}

interface CartItem {
  product: Product
  quantity: number
}

interface CashSession {
  id: string
  status: string
  openingBalance: number
  openedAt: string
  branch: { id: string; name: string }
  openedBy: { id: string; name: string | null; email: string }
}

interface SaleReceipt {
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
  createdAt: string
  branch: { name: string }
  cashier: { name: string | null }
  items: Array<{
    id: string
    productId: string
    product: { name: string; sku: string | null }
    quantity: number
    unitPrice: number
    taxRate: number
    subtotal: number
    total: number
  }>
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface POSClientProps {
  userId: string
  userName: string
  businessId: string
  businessName: string
  branchId?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function POSClient({ userName, businessName, branchId }: POSClientProps) {
  const [cashSession, setCashSession] = useState<CashSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [cart, setCart] = useState<CartItem[]>([])

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MIXED'>('CASH')
  const [amountPaid, setAmountPaid] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [receipt, setReceipt] = useState<SaleReceipt | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch active cash session on mount ────────────────────────────────────

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/cash-sessions/active')
        const data = await res.json()
        setCashSession(data.cashSession ?? null)
      } catch {
        setCashSession(null)
      } finally {
        setSessionLoading(false)
      }
    }
    loadSession()
  }, [])

  // ── Product search (debounced 300ms) ──────────────────────────────────────

  const searchProducts = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!q.trim()) {
        setProducts([])
        return
      }
      debounceRef.current = setTimeout(async () => {
        setSearchLoading(true)
        try {
          const params = new URLSearchParams({ q })
          if (cashSession?.branch.id) params.set('branchId', cashSession.branch.id)
          else if (branchId) params.set('branchId', branchId)
          const res = await fetch(`/api/products/search?${params}`)
          const data = await res.json()
          setProducts(data.products ?? [])
        } catch {
          setProducts([])
        } finally {
          setSearchLoading(false)
        }
      }, 300)
    },
    [cashSession, branchId]
  )

  useEffect(() => {
    searchProducts(search)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, searchProducts])

  // ── Cart helpers ──────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.product.id === product.id)
      if (existing) {
        return prev.map((ci) =>
          ci.product.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((ci) => ci.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((ci) => (ci.product.id === productId ? { ...ci, quantity: qty } : ci))
      )
    }
  }

  function clearCart() {
    setCart([])
    setAmountPaid('')
    setDiscountAmount('')
    setNotes('')
    setError(null)
    setPaymentMethod('CASH')
  }

  // ── Totals ────────────────────────────────────────────────────────────────

  const subtotal = cart.reduce((s, ci) => s + ci.product.price * ci.quantity, 0)
  const taxAmount = cart.reduce(
    (s, ci) => s + Math.round(ci.product.price * ci.quantity * ci.product.taxRate * 100) / 100,
    0
  )
  const discount = parseFloat(discountAmount) || 0
  const total = Math.round((subtotal + taxAmount - discount) * 100) / 100
  const paid = parseFloat(amountPaid) || 0
  const change = paymentMethod === 'CASH' ? Math.round((paid - total) * 100) / 100 : 0

  // ── Submit sale ───────────────────────────────────────────────────────────

  async function handleSale() {
    if (!cashSession) return
    if (cart.length === 0) { setError('Agrega al menos un producto al carrito.'); return }
    if (paymentMethod === 'CASH' && paid < total) {
      setError(`Monto insuficiente. Total: ${fmt(total)}, Recibido: ${fmt(paid)}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashSessionId: cashSession.id,
          items: cart.map((ci) => ({
            productId: ci.product.id,
            quantity: ci.quantity,
            unitPrice: ci.product.price,
          })),
          paymentMethod,
          amountPaid: paymentMethod === 'CASH' ? paid : total,
          discountAmount: discount,
          notes: notes || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al registrar la venta')
        return
      }

      setReceipt(data.sale)
      clearCart()
      setSearch('')
      setProducts([])
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  // ── Render: no active session ─────────────────────────────────────────────

  if (!cashSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Caja cerrada</h2>
          <p className="text-gray-500 text-sm mb-6">
            Debes abrir una caja antes de registrar ventas.
          </p>
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

  // ── Render: POS ───────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Inicio</a>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-800">Ventory POS</span>
          <span className="text-xs text-gray-400">{businessName}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            Caja: <span className="font-medium text-green-600">{cashSession.branch.name}</span>
          </span>
          <span>Cajero: <span className="font-medium">{userName}</span></span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: product search + grid */}
        <div className="flex flex-col flex-1 min-w-0 p-4 gap-3">
          {/* Search */}
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {searchLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ↻
              </span>
            )}
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto">
            {products.length === 0 && search.trim() ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                No se encontraron productos
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                <span className="text-5xl mb-3">🔍</span>
                <span className="text-sm">Escribe para buscar productos</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-blue-400 hover:shadow-sm transition-all group"
                  >
                    <div className="w-full aspect-square bg-gray-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">📦</span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-blue-600">
                      {p.name}
                    </p>
                    {p.category && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>
                    )}
                    <p className="text-sm font-bold text-blue-600 mt-1">{fmt(p.price)}</p>
                    {p.stock !== null && (
                      <p className={`text-xs mt-0.5 ${p.stock <= 5 ? 'text-orange-500' : 'text-gray-400'}`}>
                        Stock: {p.stock}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: cart + payment */}
        <div className="w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col shrink-0">
          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Carrito {cart.length > 0 && <span className="text-blue-600">({cart.length})</span>}
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">
                Limpiar
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                <span className="text-3xl mb-2">🛒</span>
                <span className="text-xs">El carrito está vacío</span>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((ci) => (
                  <div
                    key={ci.product.id}
                    className="flex items-center gap-2 py-2 border-b border-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{ci.product.name}</p>
                      <p className="text-xs text-gray-400">{fmt(ci.product.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(ci.product.id, ci.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-xs"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{ci.quantity}</span>
                      <button
                        onClick={() => updateQty(ci.product.id, ci.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-xs"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-20 text-right text-xs font-semibold text-gray-700">
                      {fmt(ci.product.price * ci.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + payment */}
          <div className="border-t border-gray-200 px-4 py-3 space-y-3">
            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>IVA</span>
                <span>{fmt(taxAmount)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento</span>
                  <span>− {fmt(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            {/* Discount */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Descuento $</label>
              <input
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Payment method */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Método de pago</p>
              <div className="grid grid-cols-2 gap-1">
                {(['CASH', 'CARD', 'TRANSFER', 'MIXED'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      paymentMethod === m
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash fields */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 shrink-0 w-20">Recibido $</label>
                  <input
                    type="number"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {paid > 0 && (
                  <div className="flex justify-between text-sm font-semibold bg-green-50 rounded-lg px-3 py-2">
                    <span className="text-green-700">Cambio</span>
                    <span className={change < 0 ? 'text-red-600' : 'text-green-700'}>
                      {fmt(Math.max(change, 0))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales..."
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSale}
              disabled={submitting || cart.length === 0}
              className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Procesando...' : `Cobrar ${cart.length > 0 ? fmt(total) : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              {/* Receipt header */}
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">✅</div>
                <h3 className="font-bold text-lg text-gray-800">Venta registrada</h3>
                <p className="text-2xl font-bold text-blue-600 mt-1">{receipt.folio}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(receipt.createdAt).toLocaleString('es-CO')}
                </p>
              </div>

              {/* Branch + cashier */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-xs text-gray-500 flex justify-between">
                <span>Sucursal: <b className="text-gray-700">{receipt.branch?.name}</b></span>
                <span>Cajero: <b className="text-gray-700">{receipt.cashier?.name ?? '-'}</b></span>
              </div>

              {/* Items */}
              <div className="space-y-1.5 mb-4">
                {receipt.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="font-medium">{fmt(item.total)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{fmt(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>IVA</span><span>{fmt(receipt.taxAmount)}</span>
                </div>
                {receipt.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento</span><span>− {fmt(receipt.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span><span>{fmt(receipt.total)}</span>
                </div>
                <div className="flex justify-between text-gray-500 mt-2 pt-2 border-t border-gray-100">
                  <span>Método: {PAYMENT_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</span>
                  {receipt.paymentMethod === 'CASH' && (
                    <span>Cambio: <b className="text-green-600">{fmt(receipt.changeGiven)}</b></span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setReceipt(null)}
                className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
              >
                Nueva venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
