'use client'

// Store central del frontend Ventory — estado + acciones que replican 1:1 los
// métodos del prototipo (docs/prototype/Ventory POS.dc.html), pero persistiendo
// todo contra la API. Las pantallas consumen useApp() y no llaman fetch directo.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  api,
  ApiError,
  Product,
  Category,
  Customer,
  Supplier,
  Sale,
  Purchase,
  CashMovement,
  CashSessionSummary,
  Shift,
  HeldSale,
  HeldPurchase,
  AppUser,
  Settings,
  Branch,
  DailyReport,
  RangeReport,
  AbonoReceipt,
  ShiftStat,
} from './api'
import { cartSubtotal, saleTotal, resolvePayment, expectedBalance } from '@/lib/pos'
import { queueSale, syncPendingSales, pendingSales, registerServiceWorker } from './offline'

export type Screen =
  | 'panel'
  | 'pos'
  | 'cobro'
  | 'receipt'
  | 'ticket'
  | 'cierre'
  | 'productos'
  | 'ventas'
  | 'reportes'
  | 'clientes'
  | 'clienteperfil'
  | 'compras'
  | 'nuevacompra'
  | 'movimientos'
  | 'proveedores'
  | 'esperas'
  | 'devoluciones'
  | 'reciboAbono'
  | 'cierreRecibo'
  | 'compraRecibo'

export type ModalId =
  | 'producto'
  | 'cliente'
  | 'proveedor'
  | 'abono'
  | 'abonoCompra'
  | 'creditoVenta'
  | 'ventaDetalle'
  | 'devolucion'
  | 'compraDetalle'
  | 'categorias'
  | 'ajusteinv'
  | 'traslado'
  | 'itemDsc'
  | 'usuarios'
  | 'usuarioForm'
  | 'ajustes'
  | 'aperturaCaja'
  | 'apertura'
  | 'confirm'
  | 'novedades'
  | 'contact'
  | 'peso'
  | 'variante'
  | 'importar'
  | 'scanner'
  | 'auditoria'
  | null

export interface CartLine {
  productId: string
  name: string
  sku: string | null
  price: number
  cost: number | null
  imageUrl?: string | null
  qty: number
  dscPct: number
  /** 'kg' = vendido por peso (qty en kilos) */
  unit?: string | null
}

export interface PayState {
  efectivo: boolean
  tarjeta: boolean
  transferencia: boolean
  credito: boolean
}

export interface NcItem {
  productId: string
  name: string
  sku: string | null
  qty: number
  unit: number
  total: number
  pct: number
  price: number
}

export interface ConfirmSpec {
  title: string
  label: string
  btnLabel: string
  onConfirm: () => void | Promise<void>
}

export interface CierrePreview {
  apertura: number
  ventas: number
  ingresos: number
  gastos: number
  esperado: number
  contado: number
  diff: number
  fecha: string
}

// Resultado de un cierre ya ejecutado — alimenta el recibo imprimible
export interface CierreResult {
  openingBalance: number
  salesTotal: number
  /** Parte en efectivo de las ventas — lo único que suma al esperado del cajón */
  cashSales: number
  incomes: number
  expenses: number
  expectedBalance: number
  countedBalance: number
  difference: number
  salesCount: number
  byMethod: Record<string, number>
  // Actividad del turno (conteo + total); las filas en cero no se imprimen
  creditSales: ShiftStat
  customerPayments: ShiftStat
  purchases: ShiftStat
  supplierPayments: ShiftStat
  returns: ShiftStat
  /** Apertura del turno siguiente, o null si fue cierre del día */
  nextOpening: number | null
  closedAt: string
  branchName: string
  cashierName: string
  businessName: string
}

interface AppData {
  loading: boolean
  settings: Settings | null
  branches: Branch[]
  products: Product[]
  categories: Category[]
  customers: Customer[]
  suppliers: Supplier[]
  sales: Sale[]
  purchases: Purchase[]
  movements: CashMovement[]
  movementDescriptions: { INCOME: string[]; EXPENSE: string[] }
  heldSales: HeldSale[]
  heldPurchases: HeldPurchase[]
  shifts: Shift[]
  users: AppUser[]
  cash: CashSessionSummary
  report: DailyReport | null
}

const defaultPay: PayState = { efectivo: true, tarjeta: false, transferencia: false, credito: false }

const initialData: AppData = {
  loading: true,
  settings: null,
  branches: [],
  products: [],
  categories: [],
  customers: [],
  suppliers: [],
  sales: [],
  purchases: [],
  movements: [],
  movementDescriptions: {
    INCOME: ['Base de caja', 'Abono de cliente', 'Otro ingreso'],
    EXPENSE: ['Pago a proveedor', 'Servicios públicos', 'Domicilios', 'Otro gasto'],
  },
  heldSales: [],
  heldPurchases: [],
  shifts: [],
  users: [],
  cash: { session: null },
  report: null,
}

export interface AppStore extends AppData {
  // sesión
  me: { name: string; email: string; role: string }
  isAdmin: boolean
  logout: () => void

  // navegación / UI
  screen: Screen
  go: (s: Screen) => void
  modal: ModalId
  openModal: (m: Exclude<ModalId, null>) => void
  closeModal: () => void
  theme: 'claro' | 'oscuro'
  setTheme: (t: 'claro' | 'oscuro') => void
  toastMsg: string
  toast: (msg: string) => void
  fmt: (n: number) => string
  confirm: ConfirmSpec | null
  askConfirm: (spec: ConfirmSpec) => void

  // caja
  turnoAbierto: boolean
  apertura: number
  esperado: number
  ingresos: number
  gastos: number
  ventasTurno: number
  /** Parte en efectivo de las ventas del turno — lo único que suma al esperado */
  ventasEfectivo: number
  confirmAperturaCaja: (amount: number) => Promise<void>
  /** Sucursal activa en este dispositivo (para abrir caja) */
  activeBranchId: string
  setBranch: (id: string) => void
  addBranch: (name: string) => Promise<void>
  renameBranch: (id: string, name: string) => Promise<void>
  cierrePreview: CierrePreview | null
  doCierre: (declared: number) => void
  confirmApertura: (nextApertura: number) => Promise<void>
  /** Cierre del día: cierra el turno SIN abrir uno nuevo */
  confirmCierreFinal: () => Promise<void>
  lastCierre: CierreResult | null
  addMov: (type: 'INCOME' | 'EXPENSE', description: string, comment: string, amount: number) => Promise<void>

  // carrito / POS
  cart: CartLine[]
  addToCart: (p: Product) => void
  changeQty: (productId: string, d: number) => void
  /** Producto en el modal de peso (ventas por kg) */
  pesoProduct: Product | null
  /** Producto agrupador cuyo selector de variante está abierto */
  varianteProduct: Product | null
  confirmPeso: (kg: number) => void
  editPeso: (productId: string) => void
  setItemDsc: (productId: string, pct: number) => void
  clearCart: () => void
  discount: number
  discountIsPct: boolean
  setDiscount: (v: number) => void
  setDiscountIsPct: (v: boolean) => void
  customerName: string
  setCustomerName: (v: string) => void
  note: string
  setNote: (v: string) => void
  subtotal: number
  total: number
  itemCount: number

  // descuento por artículo (modal itemDsc)
  dscId: string | null
  setDscId: (id: string | null) => void

  // cobro
  pay: PayState
  amounts: { tarjeta: number; transferencia: number }
  received: number
  togglePayMethod: (k: keyof PayState) => void
  setAmount: (k: 'tarjeta' | 'transferencia', v: number) => void
  setReceived: (v: number) => void
  addReceived: (v: number) => void
  finalizeSale: () => Promise<void>
  finalizeCredito: (customerId: string) => Promise<void>
  /** Ventas guardadas sin conexión, pendientes de enviarse */
  pendingCount: number
  lastSale: Sale | null
  setLastSale: (s: Sale) => void
  newSale: () => void
  /** Última compra registrada — alimenta el recibo imprimible de compra */
  lastPurchase: Purchase | null

  // esperas
  holdSale: () => Promise<void>
  resumeSale: (id: string) => Promise<void>
  discardHeldSale: (id: string) => Promise<void>

  // ventas históricas
  saleDetId: string | null
  setSaleDetId: (id: string | null) => void
  doReturn: (saleId: string, items: Array<{ saleItemId: string; quantity: number }>, exchange: boolean) => Promise<void>
  doVoid: (saleId: string) => Promise<void>
  refreshSales: (params?: string) => Promise<void>

  // productos / catálogo
  saveProduct: (data: Record<string, unknown>, editId: string | null) => Promise<boolean>
  addVariants: (productId: string, data: Record<string, unknown>) => Promise<boolean>
  archiveProduct: (id: string) => Promise<void>
  addCategory: (name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  applyAjuste: (q: Record<string, number>) => Promise<void>
  doTraslado: (productId: string, quantity: number, direction: 'in' | 'out') => Promise<void>
  editProdId: string | null
  setEditProdId: (id: string | null) => void
  refreshProducts: () => Promise<void>

  // clientes
  saveCliente: (data: Record<string, unknown>, editId: string | null) => Promise<boolean>
  deleteCliente: (id: string) => Promise<void>
  payClient: (id: string, amount: number, method: string) => Promise<void>
  abonoId: string | null
  setAbonoId: (id: string | null) => void
  editClientId: string | null
  setEditClientId: (id: string | null) => void
  perfilId: string | null
  setPerfilId: (id: string | null) => void
  lastAbono: AbonoReceipt | null
  refreshCustomers: () => Promise<void>

  // proveedores
  saveProv: (data: { name: string; phone?: string }, editId: string | null) => Promise<boolean>
  deleteProv: (id: string) => Promise<void>
  editProvId: string | null
  setEditProvId: (id: string | null) => void

  // compras
  ncProv: string
  setNcProv: (v: string) => void
  ncItems: NcItem[]
  setNcItems: (items: NcItem[]) => void
  ncMethod: 'contado' | 'transferencia' | 'credito'
  setNcMethod: (m: 'contado' | 'transferencia' | 'credito') => void
  ncAbono: number
  setNcAbono: (v: number) => void
  saveNuevaCompra: () => Promise<void>
  holdPurchase: () => Promise<void>
  resumePurchase: (id: string) => Promise<void>
  discardHeldPurchase: (id: string) => Promise<void>
  payCompra: (id: string, amount: number, method: string) => Promise<void>
  abonoCompraId: string | null
  setAbonoCompraId: (id: string | null) => void
  compraDetId: string | null
  setCompraDetId: (id: string | null) => void

  // usuarios / ajustes
  saveUser: (data: Record<string, unknown>, editId: string | null) => Promise<boolean>
  toggleUser: (u: AppUser) => Promise<void>
  editUserId: string | null
  setEditUserId: (id: string | null) => void
  saveSettings: (data: Record<string, unknown>) => Promise<void>
  /** Envía el resumen diario de prueba al correo configurado */
  probarNotificacion: () => Promise<void>

  // reportes
  loadReport: (date: string) => Promise<void>
  rangeReport: RangeReport | null
  loadRangeReport: (from: string, to: string) => Promise<void>

  refreshCash: () => Promise<void>
  refreshAll: () => Promise<void>
}

const AppContext = createContext<AppStore | null>(null)

export function useApp(): AppStore {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'CASHIER'
  const isAdmin = role === 'ADMIN' || role === 'SUPERVISOR'
  const me = {
    name: (session?.user as { name?: string } | undefined)?.name ?? 'Usuario',
    email: session?.user?.email ?? '',
    role,
  }

  const [data, setData] = useState<AppData>(initialData)
  const [screen, setScreen] = useState<Screen>('panel')
  const [modal, setModal] = useState<ModalId>(null)
  const [theme, setThemeState] = useState<'claro' | 'oscuro'>('claro')
  const [toastMsg, setToastMsg] = useState('')
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)

  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [discountIsPct, setDiscountIsPct] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [pay, setPay] = useState<PayState>(defaultPay)
  const [amounts, setAmounts] = useState({ tarjeta: 0, transferencia: 0 })
  const [received, setReceived] = useState(0)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [lastAbono, setLastAbono] = useState<AbonoReceipt | null>(null)
  const [cierrePreview, setCierrePreview] = useState<CierrePreview | null>(null)
  const [lastCierre, setLastCierre] = useState<CierreResult | null>(null)
  const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null)
  const [pesoProduct, setPesoProduct] = useState<Product | null>(null)
  const [varianteProduct, setVarianteProduct] = useState<Product | null>(null)
  const [rangeReport, setRangeReport] = useState<RangeReport | null>(null)
  // Ventas guardadas sin conexión, pendientes de enviar
  const [pendingCount, setPendingCount] = useState(0)
  // Sucursal activa de este dispositivo (para abrir caja); se guarda localmente
  const [branchId, setBranchIdState] = useState<string>(() =>
    typeof window === 'undefined' ? '' : window.localStorage.getItem('ventory-branch') ?? '',
  )

  const [saleDetId, setSaleDetId] = useState<string | null>(null)
  const [editProdId, setEditProdId] = useState<string | null>(null)
  const [editClientId, setEditClientId] = useState<string | null>(null)
  const [editProvId, setEditProvId] = useState<string | null>(null)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [abonoId, setAbonoId] = useState<string | null>(null)
  const [dscId, setDscId] = useState<string | null>(null)
  const [abonoCompraId, setAbonoCompraId] = useState<string | null>(null)
  const [compraDetId, setCompraDetId] = useState<string | null>(null)
  const [perfilId, setPerfilId] = useState<string | null>(null)

  // Nueva compra (persiste al navegar, como la "compra en curso" del prototipo)
  const [ncProv, setNcProv] = useState('')
  const [ncItems, setNcItems] = useState<NcItem[]>([])
  const [ncMethod, setNcMethod] = useState<'contado' | 'transferencia' | 'credito'>('contado')
  const [ncAbono, setNcAbono] = useState(0)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const toast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600)
  }, [])

  const patch = useCallback((p: Partial<AppData>) => setData((prev) => ({ ...prev, ...p })), [])

  const onError = useCallback(
    (e: unknown) => {
      toast(e instanceof ApiError ? e.message : 'Ocurrió un error inesperado')
    },
    [toast],
  )

  // ─── Cargas ────────────────────────────────────────────────────────────────

  const refreshProducts = useCallback(async () => {
    // El stock mostrado es el de la sucursal activa (donde se abre la caja)
    const branch = typeof window !== 'undefined' ? window.localStorage.getItem('ventory-branch') : null
    const r = await api.productsIn(branch ?? undefined)
    patch({ products: r.products })
  }, [patch])

  const refreshCustomers = useCallback(async () => {
    const r = await api.customers()
    patch({ customers: r.customers.map((c) => ({ ...c, balance: Number(c.balance) })) })
  }, [patch])

  const refreshSales = useCallback(
    async (params = '') => {
      const r = await api.sales(params)
      patch({ sales: r.sales })
    },
    [patch],
  )

  const refreshCash = useCallback(async () => {
    const r = await api.currentCashSession()
    patch({ cash: r })
  }, [patch])

  const refreshAdmin = useCallback(async () => {
    if (!isAdmin) return
    const [sup, pur, mov, hp, users] = await Promise.all([
      api.suppliers().catch(() => ({ suppliers: [] })),
      api.purchases().catch(() => ({ purchases: [] })),
      api.cashMovements().catch(() => ({ movements: [], descriptions: initialData.movementDescriptions })),
      api.heldPurchases().catch(() => ({ heldPurchases: [] })),
      api.users().catch(() => ({ users: [] })),
    ])
    patch({
      suppliers: sup.suppliers,
      purchases: pur.purchases,
      movements: mov.movements,
      movementDescriptions: mov.descriptions ?? initialData.movementDescriptions,
      heldPurchases: hp.heldPurchases,
      users: users.users,
    })
  }, [isAdmin, patch])

  const refreshAll = useCallback(async () => {
    try {
      const [settings, branches, prod, cat, cust, sales, hs, shifts, cash] = await Promise.all([
        api.settings(),
        api.branches(),
        api.products(),
        api.categories(),
        api.customers(),
        api.sales(),
        api.heldSales(),
        api.shifts().catch(() => ({ shifts: [] })),
        api.currentCashSession(),
      ])
      patch({
        loading: false,
        settings: settings.settings,
        branches: branches.branches,
        products: prod.products,
        categories: cat.categories,
        customers: cust.customers.map((c) => ({ ...c, balance: Number(c.balance) })),
        sales: sales.sales,
        heldSales: hs.heldSales,
        shifts: shifts.shifts,
        cash,
      })
      await refreshAdmin()
      // Sin turno abierto → modal de apertura de caja (flujo del prototipo)
      if (!cash.session) setModal('aperturaCaja')
    } catch (e) {
      patch({ loading: false })
      onError(e)
    }
  }, [patch, refreshAdmin, onError])

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('ventory-theme') : null
    if (saved === 'oscuro') setThemeState('oscuro')
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Modo offline: registra el service worker y envía las ventas encoladas
  // al cargar y cada vez que vuelve la conexión.
  useEffect(() => {
    registerServiceWorker()
    let alive = true
    const flush = async () => {
      const queued = await pendingSales()
      if (!alive) return
      setPendingCount(queued.length)
      if (!queued.length || !navigator.onLine) return
      const { sent, rejected } = await syncPendingSales()
      if (!alive || (sent === 0 && rejected.length === 0)) return
      const left = await pendingSales()
      setPendingCount(left.length)
      if (sent > 0) {
        toast(`${sent} venta${sent === 1 ? '' : 's'} sin conexión sincronizada${sent === 1 ? '' : 's'}`)
      }
      // Una venta encolada que el servidor rechaza no puede desaparecer en
      // silencio: el cajero tiene que enterarse para rehacerla.
      if (rejected.length > 0) {
        setTimeout(() => {
          if (alive) toast(`${rejected.length} venta sin conexión no se pudo registrar: ${rejected[0].reason}`)
        }, sent > 0 ? 2800 : 0)
      }
      await refreshAll()
    }
    flush()
    window.addEventListener('online', flush)
    return () => {
      alive = false
      window.removeEventListener('online', flush)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = useCallback((t: 'claro' | 'oscuro') => {
    setThemeState(t)
    window.localStorage.setItem('ventory-theme', t)
  }, [])

  // ─── Formato de dinero (COP enteros con puntos de miles) ──────────────────

  const currency = data.settings?.currency ?? '$'
  const fmt = useCallback(
    (n: number) =>
      (currency === 'COP' ? '$' : currency) +
      ' ' +
      Math.round(n || 0)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    [currency],
  )

  // ─── Derivados de caja ────────────────────────────────────────────────────

  const apertura = data.cash.session ? Number(data.cash.session.openingBalance) : 0
  const ventasTurno = data.cash.summary?.totalSales ?? 0
  // Solo el efectivo entra al cajón: el esperado no incluye tarjeta/transferencia/crédito
  const ventasEfectivo = data.cash.summary?.cashSales ?? 0
  const ingresos = data.cash.summary?.incomes ?? 0
  const gastos = data.cash.summary?.expenses ?? 0
  const esperado = data.cash.session
    ? expectedBalance(apertura, ventasEfectivo, ingresos, gastos)
    : 0
  const turnoAbierto = !!data.cash.session

  // ─── Carrito ───────────────────────────────────────────────────────────────

  const addToCart = useCallback((p: Product) => {
    // Producto con variantes: no se vende el agrupador, hay que elegir cuál
    if (p.hasVariants) {
      setVarianteProduct(p)
      setModal('variante')
      return
    }
    // Productos por peso: se digita el peso en el modal en vez de sumar 1
    if (p.unitOfMeasure === 'kg') {
      setPesoProduct(p)
      setModal('peso')
      return
    }
    setCart((c) => {
      const ex = c.find((i) => i.productId === p.id)
      if (ex) return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i))
      return [
        ...c,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
          cost: p.cost,
          imageUrl: p.imageUrl,
          qty: 1,
          dscPct: 0,
        },
      ]
    })
  }, [])

  // Fija el peso (en kg) de un producto vendido por peso — agrega o reemplaza
  const confirmPeso = useCallback(
    (kg: number) => {
      const p = pesoProduct
      if (!p || kg <= 0) return
      const qty = Math.round(kg * 1000) / 1000
      setCart((c) => {
        const ex = c.find((i) => i.productId === p.id)
        if (ex) return c.map((i) => (i.productId === p.id ? { ...i, qty } : i))
        return [
          ...c,
          {
            productId: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            cost: p.cost,
            imageUrl: p.imageUrl,
            qty,
            dscPct: 0,
            unit: 'kg',
          },
        ]
      })
      setPesoProduct(null)
      setModal(null)
    },
    [pesoProduct],
  )

  // Reabre el modal de peso para editar la cantidad de un ítem por kg
  const editPeso = useCallback(
    (productId: string) => {
      const p = data.products.find((x) => x.id === productId)
      if (!p) return
      setPesoProduct(p)
      setModal('peso')
    },
    [data.products],
  )

  const changeQty = useCallback((productId: string, d: number) => {
    setCart((c) =>
      c
        .map((i) => {
          if (i.productId !== productId) return i
          // Por peso: los botones ± mueven de a 100 g
          const step = i.unit === 'kg' ? d * 0.1 : d
          return { ...i, qty: Math.round((i.qty + step) * 1000) / 1000 }
        })
        .filter((i) => i.qty > 0),
    )
  }, [])

  const setItemDsc = useCallback((productId: string, pct: number) => {
    setCart((c) => c.map((i) => (i.productId === productId ? { ...i, dscPct: pct } : i)))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setDiscount(0)
  }, [])

  const cartLines = cart.map((i) => ({ unitPrice: i.price, quantity: i.qty, discountPct: i.dscPct }))
  const subtotal = cartSubtotal(cartLines)
  const total = saleTotal(cartLines, discount, discountIsPct)
  const itemCount = cart.reduce((s, i) => s + (i.unit === 'kg' ? 1 : i.qty), 0)

  // ─── Cobro ────────────────────────────────────────────────────────────────

  const togglePayMethod = useCallback((k: keyof PayState) => {
    setPay((p0) => {
      let p = { ...p0 }
      let a = { tarjeta: 0, transferencia: 0 }
      if (k === 'credito') {
        const on = !p.credito
        p = { efectivo: !on, tarjeta: false, transferencia: false, credito: on }
      } else {
        if (p.credito) p = { efectivo: false, tarjeta: false, transferencia: false, credito: false }
        p[k] = !p[k]
        p.credito = false
        if (!p.efectivo && !p.tarjeta && !p.transferencia) p.efectivo = true
        a = {
          tarjeta: p.tarjeta ? amounts.tarjeta : 0,
          transferencia: p.transferencia ? amounts.transferencia : 0,
        }
      }
      setAmounts(a)
      setReceived(0)
      return p
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amounts])

  const setAmount = useCallback((k: 'tarjeta' | 'transferencia', v: number) => {
    setAmounts((a) => ({ ...a, [k]: v }))
  }, [])

  const addReceived = useCallback((v: number) => setReceived((r) => r + v), [])

  const newSale = useCallback(() => {
    setCart([])
    setDiscount(0)
    setDiscountIsPct(false)
    setPay(defaultPay)
    setAmounts({ tarjeta: 0, transferencia: 0 })
    setReceived(0)
    setNote('')
    setCustomerName('')
    setScreen('pos')
  }, [])

  const buildSaleItems = useCallback(
    () =>
      cart.map((i) => ({
        productId: i.productId,
        quantity: i.qty,
        unitPrice: i.price,
        discountPct: i.dscPct,
      })),
    [cart],
  )

  const matchCustomerId = useCallback(() => {
    const name = customerName.trim().toLowerCase()
    if (!name) return undefined
    return data.customers.find((c) => c.name.trim().toLowerCase() === name)?.id
  }, [customerName, data.customers])

  const afterSale = useCallback(
    async (sale: Sale) => {
      setLastSale(sale)
      setCart([])
      setDiscount(0)
      setDiscountIsPct(false)
      setPay(defaultPay)
      setAmounts({ tarjeta: 0, transferencia: 0 })
      setReceived(0)
      setModal(null)
      setScreen('receipt')
      await Promise.all([refreshProducts(), refreshSales(), refreshCash(), refreshCustomers()])
    },
    [refreshProducts, refreshSales, refreshCash, refreshCustomers],
  )

  const finalizeSale = useCallback(async () => {
    if (!cart.length) return
    if (!data.cash.session) {
      toast('No hay caja abierta. Abre un turno para poder vender.')
      setModal('aperturaCaja')
      return
    }
    // Sólo un método no-efectivo sin split: se cobra el total exacto por ese método
    const nonCashSel = (['tarjeta', 'transferencia'] as const).filter((k) => pay[k])
    const singleSimple = !pay.credito && !pay.efectivo && nonCashSel.length === 1
    const card = singleSimple && nonCashSel[0] === 'tarjeta' ? total : amounts.tarjeta
    const transfer = singleSimple && nonCashSel[0] === 'transferencia' ? total : amounts.transferencia
    const resolution = resolvePayment(total, {
      card,
      transfer,
      cashActive: pay.efectivo,
      received,
    })
    if (!resolution.covered) return
    const payload = {
      cashSessionId: data.cash.session.id,
      items: buildSaleItems(),
      paymentMethod: 'CASH' as const,
      payments: { cashActive: pay.efectivo, cashReceived: received, card, transfer },
      discount,
      discountIsPct,
      customerId: matchCustomerId(),
      notes: [note, !matchCustomerId() && customerName.trim() ? `Cliente: ${customerName.trim()}` : '']
        .filter(Boolean)
        .join(' · ') || undefined,
    }
    try {
      const r = await api.createSale(payload)
      await afterSale(r.sale)
    } catch (e) {
      // Sin conexión: la venta se guarda y se envía sola al volver el internet
      if (!navigator.onLine || (e instanceof TypeError)) {
        await queueSale(payload, total)
        setPendingCount((n) => n + 1)
        toast('Sin conexión — venta guardada, se enviará al volver el internet')
        newSale()
        return
      }
      onError(e)
    }
  }, [cart, data.cash.session, pay, amounts, received, total, discount, discountIsPct, note, customerName, buildSaleItems, matchCustomerId, afterSale, newSale, toast, onError])

  const finalizeCredito = useCallback(
    async (customerId: string) => {
      if (!cart.length) return
      if (!data.cash.session) {
        toast('No hay caja abierta. Abre un turno para poder vender.')
        setModal('aperturaCaja')
        return
      }
      try {
        const r = await api.createSale({
          cashSessionId: data.cash.session.id,
          items: buildSaleItems(),
          paymentMethod: 'CREDIT',
          discount,
          discountIsPct,
          customerId,
          notes: note || undefined,
        })
        await afterSale(r.sale)
      } catch (e) {
        onError(e)
      }
    },
    [cart, data.cash.session, discount, discountIsPct, note, buildSaleItems, afterSale, toast, onError],
  )

  // ─── Esperas de venta ─────────────────────────────────────────────────────

  const holdSale = useCallback(async () => {
    if (!cart.length) return
    try {
      await api.createHeldSale({
        customerName: customerName.trim() || undefined,
        itemCount,
        total,
        payload: {
          cart: cart.map((i) => ({ ...i })),
          discount,
          discountIsPct,
          customer: customerName,
        },
      })
      setCart([])
      setDiscount(0)
      setCustomerName('')
      const r = await api.heldSales()
      patch({ heldSales: r.heldSales })
      toast('Venta en espera')
    } catch (e) {
      onError(e)
    }
  }, [cart, customerName, itemCount, total, discount, discountIsPct, patch, toast, onError])

  const resumeSale = useCallback(
    async (id: string) => {
      const held = data.heldSales.find((h) => h.id === id)
      if (!held) return
      try {
        // Si hay carrito activo, se guarda como nueva espera (regla del prototipo)
        if (cart.length) {
          await api.createHeldSale({
            customerName: customerName.trim() || undefined,
            itemCount,
            total,
            payload: { cart: cart.map((i) => ({ ...i })), discount, discountIsPct, customer: customerName },
          })
        }
        await api.deleteHeldSale(id)
        const p = held.payload
        setCart(p.cart.map((i) => ({ ...i, dscPct: i.dscPct ?? 0 })))
        setDiscount(p.discount ?? 0)
        setDiscountIsPct(p.discountIsPct ?? false)
        setCustomerName(p.customer ?? '')
        setScreen('pos')
        const r = await api.heldSales()
        patch({ heldSales: r.heldSales })
      } catch (e) {
        onError(e)
      }
    },
    [data.heldSales, cart, customerName, itemCount, total, discount, discountIsPct, patch, onError],
  )

  const discardHeldSale = useCallback(
    async (id: string) => {
      try {
        await api.deleteHeldSale(id)
        const r = await api.heldSales()
        patch({ heldSales: r.heldSales })
      } catch (e) {
        onError(e)
      }
    },
    [patch, onError],
  )

  // ─── Devoluciones / anulación ─────────────────────────────────────────────

  const doReturn = useCallback(
    async (saleId: string, items: Array<{ saleItemId: string; quantity: number }>, exchange: boolean) => {
      try {
        const r = await api.returnSale(saleId, items, exchange)
        setModal(null)
        if (exchange) {
          // Cambio: el valor devuelto se aplica como descuento $ en una nueva venta
          setCart([])
          setDiscount(r.creditForExchange)
          setDiscountIsPct(false)
          setScreen('pos')
          toast(`Cambio: crédito de ${fmt(r.creditForExchange)} aplicado como descuento`)
        } else {
          toast(`Devolución registrada · ${fmt(r.return.totalRefund)}`)
        }
        await Promise.all([refreshProducts(), refreshSales(), refreshCash()])
      } catch (e) {
        onError(e)
      }
    },
    [fmt, toast, refreshProducts, refreshSales, refreshCash, onError],
  )

  const doVoid = useCallback(
    async (saleId: string) => {
      try {
        const sale = data.sales.find((s) => s.id === saleId)
        await api.voidSale(saleId)
        setModal(null)
        toast(`Venta ${sale?.folio ?? ''} anulada`)
        await Promise.all([refreshProducts(), refreshSales(), refreshCash(), refreshCustomers()])
      } catch (e) {
        onError(e)
      }
    },
    [data.sales, toast, refreshProducts, refreshSales, refreshCash, refreshCustomers, onError],
  )

  // ─── Productos ────────────────────────────────────────────────────────────

  const saveProduct = useCallback(
    async (payload: Record<string, unknown>, editId: string | null) => {
      try {
        if (editId) {
          await api.updateProduct(editId, payload)
          toast('Cambios guardados')
        } else {
          // el stock inicial entra en la sucursal donde se está trabajando,
          // no siempre en la primera de la lista
          const sucursal = data.branches.find((b) => b.id === branchId) ?? data.branches[0]
          await api.createProduct({ ...payload, branchId: sucursal?.id })
          toast(payload.variantes ? 'Producto con variantes creado' : 'Producto creado')
        }
        await refreshProducts()
        return true
      } catch (e) {
        onError(e)
        return false
      }
    },
    [data.branches, branchId, toast, refreshProducts, onError],
  )

  /** Agrega variantes a un producto existente (o lo convierte en agrupador) */
  const addVariants = useCallback(
    async (productId: string, payload: Record<string, unknown>) => {
      try {
        const sucursal = data.branches.find((b) => b.id === branchId) ?? data.branches[0]
        await api.addVariants(productId, { ...payload, branchId: sucursal?.id })
        toast('Variantes agregadas')
        await refreshProducts()
        return true
      } catch (e) {
        onError(e)
        return false
      }
    },
    [data.branches, branchId, toast, refreshProducts, onError],
  )

  const archiveProduct = useCallback(
    async (id: string) => {
      try {
        await api.archiveProduct(id)
        toast('Producto archivado')
        await refreshProducts()
      } catch (e) {
        onError(e)
      }
    },
    [toast, refreshProducts, onError],
  )

  const addCategory = useCallback(
    async (name: string) => {
      try {
        await api.createCategory(name)
        const r = await api.categories()
        patch({ categories: r.categories })
        toast('Categoría creada')
      } catch (e) {
        onError(e)
      }
    },
    [patch, toast, onError],
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      try {
        await api.deleteCategory(id)
        const r = await api.categories()
        patch({ categories: r.categories })
      } catch (e) {
        onError(e)
      }
    },
    [patch, onError],
  )

  const applyAjuste = useCallback(
    async (q: Record<string, number>) => {
      const adjustments = Object.entries(q).map(([productId, quantity]) => ({ productId, quantity }))
      if (!adjustments.length) return
      try {
        const r = await api.adjustInventory(adjustments)
        setModal(null)
        if (r.adjusted) {
          toast(`Inventario ajustado · ${r.adjusted} ${r.adjusted === 1 ? 'producto' : 'productos'}`)
        }
        await refreshProducts()
      } catch (e) {
        onError(e)
      }
    },
    [toast, refreshProducts, onError],
  )

  const doTraslado = useCallback(
    async (productId: string, quantity: number, direction: 'in' | 'out') => {
      try {
        const p = data.products.find((x) => x.id === productId)
        await api.transferInventory({ productId, quantity, direction })
        setModal(null)
        toast(`Traslado registrado · ${quantity} × ${p?.name ?? ''}`)
        await refreshProducts()
      } catch (e) {
        onError(e)
      }
    },
    [data.products, toast, refreshProducts, onError],
  )

  // ─── Clientes ─────────────────────────────────────────────────────────────

  const saveCliente = useCallback(
    async (payload: Record<string, unknown>, editId: string | null) => {
      try {
        if (editId) {
          await api.updateCustomer(editId, payload)
          toast('Cliente actualizado')
        } else {
          await api.createCustomer(payload)
          toast('Cliente creado')
        }
        await refreshCustomers()
        return true
      } catch (e) {
        onError(e)
        return false
      }
    },
    [toast, refreshCustomers, onError],
  )

  const deleteCliente = useCallback(
    async (id: string) => {
      try {
        await api.deleteCustomer(id)
        setModal(null)
        setScreen((s) => (s === 'clienteperfil' ? 'clientes' : s))
        await refreshCustomers()
      } catch (e) {
        onError(e)
      }
    },
    [refreshCustomers, onError],
  )

  const payClient = useCallback(
    async (id: string, amount: number, method: string) => {
      try {
        const r = await api.payCustomer(id, amount, method)
        setLastAbono(r.receipt)
        setModal(null)
        setScreen('reciboAbono')
        await Promise.all([refreshCustomers(), refreshCash()])
      } catch (e) {
        onError(e)
      }
    },
    [refreshCustomers, refreshCash, onError],
  )

  // ─── Proveedores ──────────────────────────────────────────────────────────

  const refreshSuppliers = useCallback(async () => {
    const r = await api.suppliers()
    patch({ suppliers: r.suppliers })
  }, [patch])

  const saveProv = useCallback(
    async (payload: { name: string; phone?: string }, editId: string | null) => {
      try {
        if (editId) {
          await api.updateSupplier(editId, payload)
          toast('Proveedor actualizado')
        } else {
          await api.createSupplier(payload)
          toast('Proveedor creado')
        }
        await refreshSuppliers()
        return true
      } catch (e) {
        onError(e)
        return false
      }
    },
    [toast, refreshSuppliers, onError],
  )

  const deleteProv = useCallback(
    async (id: string) => {
      try {
        await api.deleteSupplier(id)
        await refreshSuppliers()
        toast('Proveedor eliminado')
      } catch (e) {
        onError(e)
      }
    },
    [refreshSuppliers, toast, onError],
  )

  // ─── Compras ──────────────────────────────────────────────────────────────

  const refreshPurchases = useCallback(async () => {
    const [pur, hp] = await Promise.all([api.purchases(), api.heldPurchases()])
    patch({ purchases: pur.purchases, heldPurchases: hp.heldPurchases })
  }, [patch])

  const clearNc = useCallback(() => {
    setNcProv('')
    setNcItems([])
    setNcMethod('contado')
    setNcAbono(0)
  }, [])

  const saveNuevaCompra = useCallback(async () => {
    if (!ncProv.trim() || !ncItems.length) return
    const methodMap = { contado: 'CASH', transferencia: 'TRANSFER', credito: 'CREDIT' } as const
    try {
      const valor = ncItems.reduce((a, i) => a + (i.total || i.qty * i.unit), 0)
      const r = await api.createPurchase({
        supplierName: ncProv.trim(),
        method: methodMap[ncMethod],
        initialPayment: ncMethod === 'credito' ? ncAbono : 0,
        items: ncItems.map((i) => ({
          productId: i.productId,
          quantity: i.qty,
          unitCost: i.unit,
          totalCost: i.total || i.qty * i.unit,
          newPrice: i.price || undefined,
        })),
      })
      clearNc()
      setLastPurchase(r.purchase)
      setScreen('compraRecibo')
      toast(`Compra registrada · ${fmt(valor)}`)
      await Promise.all([refreshPurchases(), refreshProducts(), refreshSuppliers(), refreshCash()])
    } catch (e) {
      onError(e)
    }
  }, [ncProv, ncItems, ncMethod, ncAbono, clearNc, toast, fmt, refreshPurchases, refreshProducts, refreshSuppliers, refreshCash, onError])

  const holdPurchase = useCallback(async () => {
    if (!ncItems.length) return
    try {
      await api.createHeldPurchase({
        supplierName: ncProv.trim() || undefined,
        total: ncItems.reduce((a, i) => a + (i.total || 0), 0),
        payload: {
          supplierName: ncProv,
          items: ncItems.map((i) => ({ ...i, productId: i.productId })),
          method: ncMethod,
          abono: ncAbono,
        },
      })
      clearNc()
      const r = await api.heldPurchases()
      patch({ heldPurchases: r.heldPurchases })
      toast('Compra en espera')
    } catch (e) {
      onError(e)
    }
  }, [ncProv, ncItems, ncMethod, ncAbono, clearNc, patch, toast, onError])

  const resumePurchase = useCallback(
    async (id: string) => {
      const held = data.heldPurchases.find((h) => h.id === id)
      if (!held) return
      try {
        await api.deleteHeldPurchase(id)
        const p = held.payload
        setNcProv(p.supplierName ?? '')
        setNcItems(
          (p.items ?? []).map((i) => ({
            productId: i.productId,
            name: i.name,
            sku: i.sku,
            qty: i.qty,
            unit: i.unit,
            total: i.total,
            pct: i.pct,
            price: i.price,
          })),
        )
        setNcMethod(p.method ?? 'contado')
        setNcAbono(p.abono ?? 0)
        setScreen('nuevacompra')
        const r = await api.heldPurchases()
        patch({ heldPurchases: r.heldPurchases })
      } catch (e) {
        onError(e)
      }
    },
    [data.heldPurchases, patch, onError],
  )

  const discardHeldPurchase = useCallback(
    async (id: string) => {
      try {
        await api.deleteHeldPurchase(id)
        const r = await api.heldPurchases()
        patch({ heldPurchases: r.heldPurchases })
      } catch (e) {
        onError(e)
      }
    },
    [patch, onError],
  )

  const payCompra = useCallback(
    async (id: string, amount: number, method: string) => {
      try {
        const r = await api.payPurchase(id, amount, method)
        setLastAbono(r.receipt)
        setModal(null)
        setScreen('reciboAbono')
        await Promise.all([refreshPurchases(), refreshCash()])
      } catch (e) {
        onError(e)
      }
    },
    [refreshPurchases, refreshCash, onError],
  )

  // ─── Caja / turnos ────────────────────────────────────────────────────────

  // Sucursal efectiva: la elegida en este dispositivo si sigue activa; si no, la primera
  const selectedBranchId = useCallback(() => {
    const chosen = data.branches.find((b) => b.id === branchId)
    return (chosen ?? data.branches[0])?.id
  }, [data.branches, branchId])

  const setBranch = useCallback((id: string) => {
    setBranchIdState(id)
    window.localStorage.setItem('ventory-branch', id)
  }, [])

  const addBranch = useCallback(
    async (name: string) => {
      try {
        await api.createBranch(name)
        const r = await api.branches()
        patch({ branches: r.branches })
        toast('Sucursal creada')
      } catch (e) {
        onError(e)
      }
    },
    [patch, toast, onError],
  )

  const renameBranch = useCallback(
    async (id: string, name: string) => {
      try {
        await api.updateBranch(id, { name })
        const r = await api.branches()
        patch({ branches: r.branches })
        toast('Sucursal actualizada')
      } catch (e) {
        onError(e)
      }
    },
    [patch, toast, onError],
  )

  const confirmAperturaCaja = useCallback(
    async (amount: number) => {
      const branchId = selectedBranchId()
      if (!branchId) {
        toast('Tu negocio no tiene una sucursal configurada. Recarga la página o contáctanos.')
        return
      }
      try {
        await api.openCashSession(branchId, amount)
        setModal(null)
        toast(`Caja abierta con ${fmt(amount)}`)
        await refreshCash()
      } catch (e) {
        onError(e)
      }
    },
    [selectedBranchId, toast, fmt, refreshCash, onError],
  )

  const doCierre = useCallback(
    (declared: number) => {
      setCierrePreview({
        apertura,
        ventas: ventasTurno,
        ingresos,
        gastos,
        esperado,
        contado: declared,
        diff: declared - esperado,
        fecha: new Date().toLocaleString('es-CO', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      })
      setModal('apertura')
    },
    [apertura, ventasTurno, ingresos, gastos, esperado],
  )

  const closeShift = useCallback(
    async (openNext: boolean, nextOpeningAmount?: number) => {
      const session = data.cash.session
      if (!session || !cierrePreview) return
      try {
        const r = await api.closeCashSession(session.id, {
          closingBalance: cierrePreview.contado,
          closingNotes: cierrePreview.diff !== 0 ? `Diferencia de cierre: ${cierrePreview.diff}` : undefined,
          openNext,
          nextOpeningAmount,
        })
        const zero = { count: 0, total: 0 }
        setLastCierre({
          ...r.summary,
          salesCount: r.report?.salesCount ?? 0,
          byMethod: r.report?.byMethod ?? {},
          creditSales: r.report?.creditSales ?? zero,
          customerPayments: r.report?.customerPayments ?? zero,
          purchases: r.report?.purchases ?? zero,
          supplierPayments: r.report?.supplierPayments ?? zero,
          returns: r.report?.returns ?? zero,
          nextOpening: openNext ? (nextOpeningAmount ?? cierrePreview.contado) : null,
          closedAt: new Date().toISOString(),
          branchName: session.branch.name,
          cashierName: me.name,
          businessName: data.settings?.name ?? '',
        })
        setModal(null)
        setScreen('cierreRecibo')
        const shifts = await api.shifts()
        patch({ shifts: shifts.shifts })
        await Promise.all([refreshCash(), refreshSales()])
      } catch (e) {
        onError(e)
      }
    },
    [data.cash.session, data.settings, cierrePreview, me.name, patch, refreshCash, refreshSales, onError],
  )

  const confirmApertura = useCallback(
    (nextApertura: number) => closeShift(true, nextApertura),
    [closeShift],
  )

  const confirmCierreFinal = useCallback(() => closeShift(false), [closeShift])

  const addMov = useCallback(
    async (type: 'INCOME' | 'EXPENSE', description: string, comment: string, amount: number) => {
      try {
        await api.createCashMovement({ type, description, comment: comment || undefined, amount })
        toast('Movimiento registrado')
        const r = await api.cashMovements()
        patch({ movements: r.movements })
        await refreshCash()
      } catch (e) {
        onError(e)
      }
    },
    [toast, patch, refreshCash, onError],
  )

  // ─── Usuarios / ajustes ───────────────────────────────────────────────────

  const refreshUsers = useCallback(async () => {
    const r = await api.users()
    patch({ users: r.users })
  }, [patch])

  const saveUser = useCallback(
    async (payload: Record<string, unknown>, editId: string | null) => {
      try {
        if (editId) {
          await api.updateUser(editId, payload)
          toast('Usuario actualizado')
        } else {
          await api.createUser(payload)
          toast('Usuario creado')
        }
        await refreshUsers()
        return true
      } catch (e) {
        onError(e)
        return false
      }
    },
    [toast, refreshUsers, onError],
  )

  const toggleUser = useCallback(
    async (u: AppUser) => {
      try {
        await api.updateUser(u.id, { isActive: !u.isActive })
        await refreshUsers()
      } catch (e) {
        onError(e)
      }
    },
    [refreshUsers, onError],
  )

  const saveSettings = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const r = await api.updateSettings(payload)
        patch({ settings: r.settings })
        toast('Ajustes guardados')
      } catch (e) {
        onError(e)
      }
    },
    [patch, toast, onError],
  )

  const probarNotificacion = useCallback(async () => {
    try {
      const r = await api.testNotification()
      toast(`Resumen enviado a ${r.destino}`)
    } catch (e) {
      onError(e)
    }
  }, [toast, onError])

  const loadRangeReport = useCallback(
    async (from: string, to: string) => {
      try {
        const r = await api.rangeReport(from, to)
        setRangeReport(r)
      } catch (e) {
        onError(e)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const loadReport = useCallback(
    async (date: string) => {
      try {
        const r = await api.dailyReport(date)
        patch({ report: r })
      } catch (e) {
        onError(e)
      }
    },
    [patch, onError],
  )

  // ─── Navegación / modales ─────────────────────────────────────────────────

  const go = useCallback((s: Screen) => setScreen(s), [])
  const openModal = useCallback((m: Exclude<ModalId, null>) => setModal(m), [])
  const closeModal = useCallback(() => setModal(null), [])
  const askConfirm = useCallback((spec: ConfirmSpec) => {
    setConfirm(spec)
    setModal('confirm')
  }, [])

  const logout = useCallback(() => signOut({ callbackUrl: '/login' }), [])

  const store: AppStore = useMemo(
    () => ({
      ...data,
      me,
      isAdmin,
      logout,
      screen,
      go,
      modal,
      openModal,
      closeModal,
      theme,
      setTheme,
      toastMsg,
      toast,
      fmt,
      confirm,
      askConfirm,
      turnoAbierto,
      apertura,
      esperado,
      ingresos,
      gastos,
      ventasTurno,
      ventasEfectivo,
      confirmAperturaCaja,
      activeBranchId: selectedBranchId() ?? '',
      setBranch,
      addBranch,
      renameBranch,
      cierrePreview,
      doCierre,
      confirmApertura,
      confirmCierreFinal,
      lastCierre,
      addMov,
      cart,
      addToCart,
      changeQty,
      pesoProduct,
      varianteProduct,
      confirmPeso,
      editPeso,
      setItemDsc,
      clearCart,
      discount,
      discountIsPct,
      setDiscount,
      setDiscountIsPct,
      customerName,
      setCustomerName,
      note,
      setNote,
      subtotal,
      total,
      itemCount,
      dscId,
      setDscId,
      pay,
      amounts,
      received,
      togglePayMethod,
      setAmount,
      setReceived,
      addReceived,
      finalizeSale,
      finalizeCredito,
      pendingCount,
      lastSale,
      setLastSale,
      newSale,
      lastPurchase,
      holdSale,
      resumeSale,
      discardHeldSale,
      saleDetId,
      setSaleDetId,
      doReturn,
      doVoid,
      refreshSales,
      saveProduct,
      addVariants,
      archiveProduct,
      addCategory,
      deleteCategory,
      applyAjuste,
      doTraslado,
      editProdId,
      setEditProdId,
      refreshProducts,
      saveCliente,
      deleteCliente,
      payClient,
      abonoId,
      setAbonoId,
      editClientId,
      setEditClientId,
      perfilId,
      setPerfilId,
      lastAbono,
      refreshCustomers,
      saveProv,
      deleteProv,
      editProvId,
      setEditProvId,
      ncProv,
      setNcProv,
      ncItems,
      setNcItems,
      ncMethod,
      setNcMethod,
      ncAbono,
      setNcAbono,
      saveNuevaCompra,
      holdPurchase,
      resumePurchase,
      discardHeldPurchase,
      payCompra,
      abonoCompraId,
      setAbonoCompraId,
      compraDetId,
      setCompraDetId,
      saveUser,
      toggleUser,
      editUserId,
      setEditUserId,
      saveSettings,
      probarNotificacion,
      loadReport,
      rangeReport,
      loadRangeReport,
      refreshCash,
      refreshAll,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data, me.name, me.email, me.role, isAdmin, screen, modal, theme, toastMsg, confirm,
      turnoAbierto, apertura, esperado, ingresos, gastos, ventasTurno, ventasEfectivo, cierrePreview, lastCierre, branchId,
      cart, discount, discountIsPct, customerName, note, subtotal, total, itemCount,
      pay, amounts, received, lastSale, lastPurchase, pesoProduct, varianteProduct, rangeReport, pendingCount, lastAbono, saleDetId, dscId, editProdId, editClientId,
      editProvId, editUserId, abonoId, abonoCompraId, compraDetId, perfilId,
      ncProv, ncItems, ncMethod, ncAbono, fmt,
    ],
  )

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>
}
