'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fmt } from '@/lib/format'

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
  priceOverride?: number
}

interface CashSession {
  id: string
  status: string
  openingBalance: number
  openedAt: string
  branch: { id: string; name: string }
  openedBy: { id: string; name: string | null; email: string }
}

interface CustomerResult {
  id: string
  name: string
  phone: string | null
  email: string | null
  document: string | null
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
  customer?: { id: string; name: string } | null
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function POSClient({ userName, businessName, branchId }: POSClientProps) {
  const [cashSession, setCashSession] = useState<CashSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [cart, setCart] = useState<CartItem[]>([])

  const [activeMethod, setActiveMethod] = useState<'CASH' | 'TRANSFER' | 'CARD'>('CASH')
  const [payAmountInput, setPayAmountInput] = useState('')   // cash amount
  const [transferAmount, setTransferAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [receipt, setReceipt] = useState<SaleReceipt | null>(null)
  const [posTab, setPosTab] = useState<'products' | 'cart'>('products')
  const [showPaymentScreen, setShowPaymentScreen] = useState(false)

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [padMode, setPadMode] = useState<'qty' | 'price' | 'disc'>('qty')
  const [padInput, setPadInput] = useState('')

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setPayAmountInput('')
    setTransferAmount('')
    setCardAmount('')
    setActiveMethod('CASH')
    setDiscountAmount('')
    setNotes('')
    setError(null)
    setSelectedItemId(null)
    setPadInput('')
    setShowPaymentScreen(false)
    setCustomerId(null)
    setCustomerName('')
    setCustomerQuery('')
    setCustomerResults([])
  }

  function handleCustomerSearch(q: string) {
    setCustomerQuery(q)
    setCustomerId(null)
    setCustomerName('')
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current)
    if (!q.trim() || q.length < 2) {
      setCustomerResults([])
      return
    }
    customerDebounceRef.current = setTimeout(async () => {
      setCustomerSearching(true)
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setCustomerResults(data.customers ?? [])
      } catch {
        setCustomerResults([])
      } finally {
        setCustomerSearching(false)
      }
    }, 300)
  }

  function selectCustomer(c: CustomerResult) {
    setCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerQuery(c.name)
    setCustomerResults([])
  }

  async function createAndSelectCustomer(name: string) {
    if (!name.trim()) return
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.customer) {
        selectCustomer(data.customer)
      }
    } catch {
      // ignore — customer assignment is optional
    }
  }

  function applyPadInput() {
    const raw = padInput.trim()
    if (!raw) return
    const val = Math.round(parseFloat(raw))
    if (isNaN(val)) { setPadInput(''); return }
    if (padMode === 'qty' && selectedItemId) {
      updateQty(selectedItemId, Math.max(1, val))
    } else if (padMode === 'price' && selectedItemId) {
      setCart((prev) =>
        prev.map((ci) =>
          ci.product.id === selectedItemId
            ? { ...ci, priceOverride: val > 0 ? val : undefined }
            : ci
        )
      )
    } else if (padMode === 'disc') {
      setDiscountAmount(val > 0 ? String(val) : '')
    }
    setPadInput('')
  }

  // ── Physical keyboard numpad handler ─────────────────────────────────────

  const handleSaleRef = useRef(handleSale)
  useEffect(() => { handleSaleRef.current = handleSale })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (showPaymentScreen) {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault()
          if (activeMethod === 'CASH') {
            setPayAmountInput((p) => (p.length < 12 ? p + e.key : p))
          } else if (activeMethod === 'TRANSFER') {
            setTransferAmount((p) => (p.length < 12 ? p + e.key : p))
          } else {
            setCardAmount((p) => (p.length < 12 ? p + e.key : p))
          }
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          if (activeMethod === 'CASH') {
            setPayAmountInput((p) => p.slice(0, -1))
          } else if (activeMethod === 'TRANSFER') {
            setTransferAmount((p) => p.slice(0, -1))
          } else {
            setCardAmount((p) => p.slice(0, -1))
          }
        } else if (e.key === 'Enter') {
          e.preventDefault()
          handleSaleRef.current()
        } else if (e.key === 'Escape') {
          setShowPaymentScreen(false)
        }
        return
      }

      // Cart numpad keyboard
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setPadInput((p) => (p.length < 10 ? p + e.key : p))
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPadInput((p) => p.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const val = Math.round(parseFloat(padInput))
        if (!padInput.trim() || isNaN(val)) { setPadInput(''); return }
        if (padMode === 'qty' && selectedItemId) {
          updateQty(selectedItemId, Math.max(1, val))
        } else if (padMode === 'price' && selectedItemId) {
          setCart((prev) =>
            prev.map((ci) =>
              ci.product.id === selectedItemId
                ? { ...ci, priceOverride: val > 0 ? val : undefined }
                : ci
            )
          )
        } else if (padMode === 'disc') {
          setDiscountAmount(val > 0 ? String(val) : '')
        }
        setPadInput('')
      } else if (e.key.toLowerCase() === 'q') {
        setPadMode('qty'); setPadInput('')
      } else if (e.key.toLowerCase() === 'p') {
        setPadMode('price'); setPadInput('')
      } else if (e.key.toLowerCase() === 'd') {
        setPadMode('disc'); setPadInput('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showPaymentScreen, padMode, padInput, selectedItemId, activeMethod]) // fresh closure on every change

  // ── Totals ────────────────────────────────────────────────────────────────

  const subtotal = cart.reduce((s, ci) => s + (ci.priceOverride ?? ci.product.price) * ci.quantity, 0)
  const discount = parseFloat(discountAmount) || 0
  const total = Math.round((subtotal - discount) * 100) / 100

  const cashPaid = parseFloat(payAmountInput) || 0
  const transferPaid = parseFloat(transferAmount) || 0
  const cardPaid = parseFloat(cardAmount) || 0
  const totalPaid = cashPaid + transferPaid + cardPaid
  const remainingForCash = Math.max(0, total - transferPaid - cardPaid)
  const change = cashPaid > 0 ? Math.round((cashPaid - remainingForCash) * 100) / 100 : 0
  const canFinalize = cashPaid > 0 ? cashPaid >= remainingForCash : totalPaid >= total

  // ── Submit sale ───────────────────────────────────────────────────────────

  async function handleSale() {
    if (!cashSession) return
    if (cart.length === 0) { setError('Agrega al menos un producto al carrito.'); return }
    if (!canFinalize) {
      setError(`Monto insuficiente. Total: ${fmt(total)}, Recibido: ${fmt(totalPaid)}`)
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
            unitPrice: ci.priceOverride ?? ci.product.price,
          })),
          paymentMethod: (cashPaid > 0 && transferPaid === 0 && cardPaid === 0) ? 'CASH'
            : (transferPaid > 0 && cashPaid === 0 && cardPaid === 0) ? 'TRANSFER'
            : (cardPaid > 0 && cashPaid === 0 && transferPaid === 0) ? 'CARD'
            : (cashPaid > 0 || transferPaid > 0 || cardPaid > 0) ? 'MIXED'
            : activeMethod,
          amountPaid: cashPaid > 0 ? Math.max(totalPaid, total) : total,
          discountAmount: discount,
          notes: notes || undefined,
          customerId: customerId || undefined,
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
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden relative">
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

      {/* Mobile tab bar */}
      <div className="lg:hidden flex border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => setPosTab('products')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            posTab === 'products' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setPosTab('cart')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            posTab === 'cart' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          Carrito
          {cart.length > 0 && (
            <span className="ml-1.5 bg-blue-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: product search + grid */}
        <div className={`flex-col flex-1 min-w-0 p-4 gap-3 ${posTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Search */}
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && products.length === 1) {
                  addToCart(products[0])
                  setSearch('')
                  setProducts([])
                }
              }}
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

        {/* Right: cart + numpad + payment */}
        <div className={`${posTab === 'products' ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 bg-white border-l border-gray-200 flex-col shrink-0`}>

          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-gray-800 text-sm">
              Carrito {cart.length > 0 && <span className="text-blue-600">({cart.length})</span>}
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700 touch-manipulation">
                Limpiar
              </button>
            )}
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[64px] text-gray-300">
                <span className="text-3xl mb-1">🛒</span>
                <span className="text-xs">El carrito está vacío</span>
              </div>
            ) : (
              <div className="space-y-1">
                {cart.map((ci) => {
                  const effPrice = ci.priceOverride ?? ci.product.price
                  const isSelected = selectedItemId === ci.product.id
                  return (
                    <button
                      key={ci.product.id}
                      onClick={() => {
                        setSelectedItemId(isSelected ? null : ci.product.id)
                        setPadMode('qty')
                        setPadInput('')
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors touch-manipulation ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-400' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{ci.product.name}</p>
                        <p className={`text-xs ${ci.priceOverride ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                          {fmt(effPrice)} c/u
                          {ci.priceOverride && (
                            <span className="ml-1 text-gray-300 line-through text-xs">{fmt(ci.product.price)}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-blue-600 shrink-0">×{ci.quantity}</span>
                      <span className="text-xs font-semibold text-gray-800 w-16 text-right shrink-0">
                        {fmt(effPrice * ci.quantity)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Fixed bottom: totals + numpad + cobrar */}
          <div className="shrink-0 border-t border-gray-200">

            {/* Totals row */}
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {discount > 0 ? `Desc. ${fmt(discount)}` : 'Sin descuento'}
              </span>
              <span className="font-bold text-base text-gray-900">{fmt(total)}</span>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 px-3 pb-2">
              {(['qty', 'price', 'disc'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setPadMode(m); setPadInput('') }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors touch-manipulation ${
                    padMode === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m === 'qty' ? 'CANT.' : m === 'price' ? 'PRECIO' : 'DESC.'}
                </button>
              ))}
            </div>

            {/* Numpad display */}
            <div className="mx-3 mb-2 bg-gray-900 rounded-lg px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {padMode === 'qty'
                  ? selectedItemId ? 'Cantidad' : 'Sel. ítem ↑'
                  : padMode === 'price'
                  ? selectedItemId ? 'Precio' : 'Sel. ítem ↑'
                  : 'Descuento'}
              </span>
              <span className="text-white font-mono text-lg font-bold tracking-wider">
                {padInput || '0'}
              </span>
            </div>

            {/* Numpad grid */}
            <div className="grid grid-cols-3 gap-1 px-3">
              {(['7','8','9','4','5','6','1','2','3','⌫','0','00'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === '⌫') {
                      setPadInput((p) => p.slice(0, -1))
                    } else {
                      setPadInput((p) => p.length < 10 ? p + key : p)
                    }
                  }}
                  className="h-10 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 font-semibold text-sm touch-manipulation transition-colors select-none"
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Apply button */}
            <div className="px-3 mt-1 mb-2">
              <button
                onClick={applyPadInput}
                disabled={!padInput || (padMode !== 'disc' && !selectedItemId)}
                className="w-full h-10 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm rounded-lg touch-manipulation transition-colors"
              >
                ✓ Aplicar
              </button>
            </div>

            {/* Cobrar → opens payment screen */}
            <div className="px-3 pb-3">
              <button
                onClick={() => { setShowPaymentScreen(true); setPayAmountInput(''); setTransferAmount(''); setCardAmount(''); setActiveMethod('CASH'); setError(null) }}
                disabled={cart.length === 0}
                className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                {`Cobrar ${cart.length > 0 ? fmt(total) : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment screen overlay */}
      {showPaymentScreen && (
        <div className="absolute inset-0 bg-white z-10 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="shrink-0 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
            <button
              onClick={() => setShowPaymentScreen(false)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 touch-manipulation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Volver
            </button>
            <span className="text-sm font-semibold text-gray-700">Cobro</span>
            <div className="w-14" />
          </div>

          {/* Scrollable body: left=payment inputs, right=cart column */}
          <div className="flex-1 flex flex-row overflow-hidden">

            {/* Left: payment inputs */}
            <div className="flex-1 flex flex-col px-4 pt-3 pb-2 gap-2.5 overflow-y-auto">

            {/* Total — large and prominent */}
            <div className="text-center py-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Total a cobrar</p>
              <p className="text-4xl font-bold text-gray-900 leading-none">{fmt(total)}</p>
              {discount > 0 && <p className="text-xs text-green-600 mt-1">Descuento: {fmt(discount)}</p>}
            </div>

            {/* Payment method selectors — tap one to enter its amount */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'CASH', label: 'Efectivo', icon: '💵' },
                { key: 'TRANSFER', label: 'Transferencia', icon: '📲' },
                { key: 'CARD', label: 'Tarjeta', icon: '💳' },
              ] as const).map(({ key, label, icon }) => {
                const amt = key === 'CASH' ? cashPaid : key === 'TRANSFER' ? transferPaid : cardPaid
                return (
                  <button
                    key={key}
                    onClick={() => setActiveMethod(key)}
                    className={`py-3 text-sm font-semibold rounded-xl transition-colors touch-manipulation flex flex-col items-center gap-0.5 ${
                      activeMethod === key
                        ? 'bg-blue-600 text-white shadow-sm'
                        : amt > 0
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    <span className="text-xs">{label}</span>
                    {amt > 0 && activeMethod !== key && (
                      <span className="text-xs font-bold">{fmt(amt)}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Cash input section */}
            {activeMethod === 'CASH' && (
              <>
                {(transferPaid > 0 || cardPaid > 0) && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 flex justify-between items-center text-xs">
                    <span className="text-gray-500">Restante en efectivo</span>
                    <span className="font-bold text-gray-800">{fmt(remainingForCash)}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-900 rounded-xl px-3 py-3 flex flex-col">
                    <span className="text-gray-500 text-xs mb-0.5">💵 Efectivo recibido</span>
                    <span className="text-white font-mono font-bold text-xl leading-tight">
                      {cashPaid > 0 ? fmt(cashPaid) : '$ —'}
                    </span>
                  </div>
                  <div className={`flex-1 rounded-xl px-3 py-3 flex flex-col ${
                    cashPaid === 0 ? 'bg-gray-50' : change >= 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <span className={`text-xs mb-0.5 ${cashPaid === 0 ? 'text-gray-400' : change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {change < 0 && cashPaid > 0 ? 'Falta' : 'Cambio'}
                    </span>
                    <span className={`font-bold text-xl leading-tight ${
                      cashPaid === 0 ? 'text-gray-300' : change >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {cashPaid === 0 ? '$ —' : fmt(Math.abs(change))}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setPayAmountInput(p => String((parseInt(p) || 0) + d))}
                      className="h-14 text-sm font-bold rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 touch-manipulation transition-colors select-none"
                    >
                      {d >= 1000 ? `${d / 1000}k` : d}
                    </button>
                  ))}
                  <button
                    onClick={() => setPayAmountInput(String(Math.round(remainingForCash)))}
                    className="h-14 text-sm font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 touch-manipulation transition-colors select-none"
                  >
                    Exacto
                  </button>
                  <button
                    onClick={() => setPayAmountInput('')}
                    className="h-14 text-sm font-bold rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300 touch-manipulation transition-colors select-none"
                  >
                    ⌫
                  </button>
                </div>
              </>
            )}

            {/* Transfer / Card input section */}
            {(activeMethod === 'TRANSFER' || activeMethod === 'CARD') && (
              <>
                <div className="bg-gray-900 rounded-xl px-4 py-4 flex flex-col">
                  <span className="text-gray-500 text-xs mb-1">
                    {activeMethod === 'TRANSFER' ? '📲 Transferencia' : '💳 Tarjeta'}
                  </span>
                  <span className="text-white font-mono font-bold text-2xl leading-tight">
                    {(activeMethod === 'TRANSFER' ? transferPaid : cardPaid) > 0
                      ? fmt(activeMethod === 'TRANSFER' ? transferPaid : cardPaid)
                      : '$ —'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['7','8','9','4','5','6','1','2','3'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (activeMethod === 'TRANSFER') {
                          setTransferAmount(p => p.length < 12 ? p + key : p)
                        } else {
                          setCardAmount(p => p.length < 12 ? p + key : p)
                        }
                      }}
                      className="h-14 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 font-bold text-lg touch-manipulation transition-colors select-none"
                    >
                      {key}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const remaining = activeMethod === 'TRANSFER'
                        ? Math.max(0, total - cashPaid - cardPaid)
                        : Math.max(0, total - cashPaid - transferPaid)
                      if (activeMethod === 'TRANSFER') {
                        setTransferAmount(String(Math.round(remaining)))
                      } else {
                        setCardAmount(String(Math.round(remaining)))
                      }
                    }}
                    className="h-14 flex items-center justify-center rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 font-bold text-sm touch-manipulation transition-colors select-none"
                  >
                    Exacto
                  </button>
                  <button
                    onClick={() => {
                      if (activeMethod === 'TRANSFER') {
                        setTransferAmount(p => p.length < 12 ? p + '0' : p)
                      } else {
                        setCardAmount(p => p.length < 12 ? p + '0' : p)
                      }
                    }}
                    className="h-14 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 font-bold text-lg touch-manipulation transition-colors select-none"
                  >
                    0
                  </button>
                  <button
                    onClick={() => {
                      if (activeMethod === 'TRANSFER') {
                        setTransferAmount(p => p.slice(0, -1))
                      } else {
                        setCardAmount(p => p.slice(0, -1))
                      }
                    }}
                    className="h-14 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300 font-bold text-lg touch-manipulation transition-colors select-none"
                  >
                    ⌫
                  </button>
                </div>
              </>
            )}

            {/* Running payment summary — always visible when any amount entered */}
            {totalPaid > 0 && (
              <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Total recibido</p>
                  <p className="text-white font-mono font-bold text-base">{fmt(totalPaid)}</p>
                </div>
                {cashPaid > 0 ? (
                  <div className="text-right">
                    <p className={`text-xs mb-0.5 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change < 0 ? 'Falta' : 'Cambio'}
                    </p>
                    <p className={`font-mono font-bold text-base ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(Math.abs(change))}
                    </p>
                  </div>
                ) : totalPaid >= total ? (
                  <p className="text-green-400 font-bold text-sm">✓ Cubierto</p>
                ) : (
                  <div className="text-right">
                    <p className="text-yellow-400 text-xs mb-0.5">Falta</p>
                    <p className="text-yellow-400 font-mono font-bold text-base">{fmt(total - totalPaid)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Customer search */}
            <div className="relative">
              {customerId ? (
                <div className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-blue-800 font-medium flex-1 truncate">👤 {customerName}</span>
                  <button
                    onClick={() => { setCustomerId(null); setCustomerName(''); setCustomerQuery('') }}
                    className="text-blue-400 hover:text-blue-600 text-sm font-bold touch-manipulation"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  placeholder="Buscar o crear cliente (opcional)..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {!customerId && (customerResults.length > 0 || (customerQuery.length >= 2 && !customerSearching)) && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-20 max-h-36 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between touch-manipulation"
                    >
                      <span className="font-medium text-gray-800">{c.name}</span>
                      {c.phone && <span className="text-gray-400 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                  <button
                    onClick={() => createAndSelectCustomer(customerQuery)}
                    className="w-full px-3 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium touch-manipulation"
                  >
                    + Crear &quot;{customerQuery}&quot;
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            </div>

            {/* Right: cart items column */}
            <div className="w-[34%] border-l border-gray-100 flex flex-col overflow-hidden">
              <div className="shrink-0 px-2 py-2 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Artículos</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {cart.map((item, i) => {
                  const unitPrice = item.priceOverride ?? item.product.price
                  const lineTotal = unitPrice * item.quantity
                  return (
                    <div
                      key={item.product.id}
                      className={`flex flex-col px-2 py-2 gap-0.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                    >
                      <span className="text-xs text-gray-800 leading-snug">{item.product.name}</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{item.quantity}×</span>
                        <span className="text-xs font-semibold text-gray-900 tabular-nums">{fmt(lineTotal)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="shrink-0 border-t border-gray-100 px-2 py-2 bg-gray-50">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{cart.length} {cart.length === 1 ? 'art.' : 'arts.'}</span>
                  <span className="text-xs font-bold text-gray-900 tabular-nums">{fmt(subtotal)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Finalizar — always visible at bottom */}
          <div className="shrink-0 px-4 pb-4 pt-2">
            <button
              onClick={handleSale}
              disabled={submitting || !canFinalize}
              className="w-full py-4 bg-green-600 text-white font-bold text-base rounded-2xl hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {submitting ? 'Procesando...' : `✓ Finalizar venta · ${fmt(total)}`}
            </button>
          </div>
        </div>
      )}

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
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3 text-xs text-gray-500 flex justify-between">
                <span>Sucursal: <b className="text-gray-700">{receipt.branch?.name}</b></span>
                <span>Cajero: <b className="text-gray-700">{receipt.cashier?.name ?? '-'}</b></span>
              </div>

              {/* Customer */}
              {receipt.customer && (
                <div className="bg-blue-50 rounded-xl px-4 py-3 mb-3 text-xs text-blue-700 flex items-center gap-2">
                  <span>👤</span>
                  <span>Cliente: <b>{receipt.customer.name}</b></span>
                </div>
              )}

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
