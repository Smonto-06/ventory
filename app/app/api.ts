// Cliente de API del frontend Ventory — todas las llamadas al backend pasan por aquí.
// Los montos son COP enteros (number). Los errores llegan como { error: string }.

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // sin cuerpo
  }
  if (!res.ok) {
    const b = body as { error?: string; code?: string } | null
    throw new ApiError(b?.error ?? `Error ${res.status}`, res.status, b?.code)
  }
  return body as T
}

const get = <T>(url: string) => request<T>(url)
const post = <T>(url: string, data?: unknown) =>
  request<T>(url, { method: 'POST', body: JSON.stringify(data ?? {}) })
const put = <T>(url: string, data: unknown) =>
  request<T>(url, { method: 'PUT', body: JSON.stringify(data) })
const patch = <T>(url: string, data: unknown) =>
  request<T>(url, { method: 'PATCH', body: JSON.stringify(data) })
const del = <T>(url: string) => request<T>(url, { method: 'DELETE' })

// ─── Tipos de datos (formas de respuesta del backend) ───────────────────────

export interface Product {
  id: string
  sku: string | null
  name: string
  barcode: string | null
  price: number
  cost: number | null
  /** 'kg' = se vende por peso (price es el precio por kilo); null = por unidad */
  unitOfMeasure?: string | null
  supplier: string | null
  imageUrl?: string | null
  status: string
  category: { id: string; name: string } | null
  stock: number
  minStock: number
  /** true = producto agrupador: no se vende, solo reúne a sus variantes */
  hasVariants?: boolean
  /** id del producto agrupador, si esto es una variante */
  parentId?: string | null
  /** combinación de esta variante, p. ej. "M / Azul" */
  variantLabel?: string | null
  /** definición de opciones del agrupador: [{ nombre, valores[] }] */
  variantOptions?: Array<{ nombre: string; valores: string[] }> | null
}

export interface QuoteItem {
  id: string
  productId: string
  product: { id: string; name: string; sku: string | null; unitOfMeasure?: string | null; imageUrl?: string | null }
  quantity: number
  unitPrice: number
  discountPct: number
  total: number
}

export interface Quote {
  id: string
  folio: string
  /** OPEN · EXPIRED (derivado) · CONVERTED · CANCELLED */
  status: string
  rawStatus: string
  subtotal: number
  discountAmount: number
  discountIsPct: boolean
  discountPct: number
  total: number
  notes: string | null
  validUntil: string
  convertedAt: string | null
  cancelledAt: string | null
  createdAt: string
  customer: { id: string; name: string; phone?: string | null } | null
  customerName: string | null
  createdBy: { id: string; name: string | null } | null
  branch: { id: string; name: string } | null
  sale: { id: string; folio: string } | null
  items: QuoteItem[]
}

export interface Category {
  id: string
  name: string
  description?: string | null
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email?: string | null
  document: string | null
  address?: string | null
  balance: number
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  productCount: number
  products: Array<{ id: string; name: string; sku: string | null; price: number }>
}

export interface SaleItem {
  id: string
  quantity: number
  unitPrice: number
  discountPct: number
  returnedQty: number
  costPrice: number | null
  total: number
  productId: string
  product: { id: string; name: string; sku: string | null; unitOfMeasure?: string | null }
}

export interface Sale {
  id: string
  folio: string
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
  subtotal: number
  discountAmount: number
  total: number
  taxAmount: number
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT'
  amountPaid: number
  changeGiven: number
  notes: string | null
  createdAt: string
  items: SaleItem[]
  payments: Array<{ id: string; method: string; amount: number }>
  returns?: Array<{ id: string; type: string; totalRefund: number }>
  cashier: { id: string; name: string | null }
  branch?: { id: string; name: string } | null
  customer: { id: string; name: string } | null
}

export interface Purchase {
  id: string
  method: 'CASH' | 'TRANSFER' | 'CREDIT'
  total: number
  paidAmount: number
  balance: number
  notes: string | null
  createdAt: string
  supplier: { id: string; name: string }
  items: Array<{
    id: string
    quantity: number
    unitCost: number
    totalCost: number
    newPrice: number | null
    product: { id: string; name: string; sku: string | null; unitOfMeasure?: string | null }
  }>
  payments: Array<{ id: string; amount: number; method: string; createdAt: string }>
}

export interface CashMovement {
  id: string
  type: 'INCOME' | 'EXPENSE' | 'WITHDRAWAL'
  amount: number
  description: string
  comment: string | null
  createdAt: string
}

export interface CashSessionSummary {
  session: {
    id: string
    openingBalance: number
    openedAt: string
    branch: { id: string; name: string }
    movements: CashMovement[]
  } | null
  summary?: {
    totalSales: number
    cashSales: number
    incomes: number
    expenses: number
    expectedBalance: number
  }
}

export interface Shift {
  id: string
  openedAt: string
  closedAt: string
  openingBalance: number
  salesTotal: number
  incomes: number
  expenses: number
  expectedBalance: number
  countedBalance: number
  difference: number
  closedBy: { id: string; name: string | null } | null
}

export interface HeldSalePayload {
  cart: Array<{
    productId: string
    name: string
    sku: string | null
    price: number
    cost: number | null
    imageUrl?: string | null
    qty: number
    dscPct?: number
  }>
  discount: number
  discountIsPct: boolean
  customer: string
}

export interface HeldSale {
  id: string
  customerName: string | null
  itemCount: number
  total: number
  payload: HeldSalePayload
  createdAt: string
}

export interface HeldPurchasePayload {
  supplierName: string
  items: Array<{
    productId: string
    name: string
    sku: string | null
    qty: number
    unit: number
    total: number
    pct: number
    price: number
  }>
  method: 'contado' | 'transferencia' | 'credito'
  abono: number
}

export interface HeldPurchase {
  id: string
  supplierName: string | null
  total: number
  payload: HeldPurchasePayload
  createdAt: string
}

export interface AppUser {
  id: string
  name: string | null
  email: string
  role: 'ADMIN' | 'SUPERVISOR' | 'CASHIER' | 'SELLER'
  isActive: boolean
  branchId: string | null
  branch?: { id: string; name: string } | null
}

export interface PlanInfo {
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED'
  trialEndsAt: string | null
  /** Vigencia pagada por Wompi; null en ACTIVE = activación manual sin vencer */
  paidUntil: string | null
  daysLeft: number | null
  blocked: boolean
}

// Conteo + total de una actividad del turno (para el recibo de cierre)
export interface ShiftStat {
  count: number
  total: number
}

export interface Settings {
  id: string
  name: string
  currency: string
  ivaPct: number
  defaultOpeningAmount: number
  allowNegativeStock: boolean
  barcodeEnabled: boolean
  // Datos impresos en la factura de venta
  taxId?: string | null
  phone?: string | null
  address?: string | null
  receiptFooter?: string | null
  // Notificaciones automáticas
  notifyDailySummary?: boolean
  notifyLowStock?: boolean
  notifyEmail?: string | null
  plan?: PlanInfo
  /** true si hay una pasarela configurada (aparece el botón de pago) */
  pagoEnLinea?: boolean
  /** cuál pasarela cobra: Wompi tiene prioridad; Mercado Pago es la interina */
  pasarela?: 'wompi' | 'mercadopago' | null
  isSuperAdmin?: boolean
}

export interface Branch {
  id: string
  name: string
}

export interface DailyReport {
  date: string
  salesByHour: Array<{ hour: number; total: number; count: number }>
  byPaymentMethod: Record<string, number>
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>
  summary: {
    totalSales: number
    transactionCount: number
    averageSale: number
    itemsPerSale: number
    totalItems: number
  }
  profit: {
    sales: number
    costOfGoods: number
    gross: number
    marginPct: number
    expenses: number
    net: number
  }
  cashSummary: {
    openingBalance: number
    totalSales: number
    /** Parte en efectivo de las ventas del turno — lo único que suma al cajón */
    cashSales: number
    incomes: number
    expenses: number
    expectedBalance: number
    transactionCount: number
  }
}

export interface RangeReport {
  from: string
  to: string
  days: number
  summary: { totalSales: number; transactionCount: number; averageSale: number; totalItems: number }
  salesByDay: Array<{ date: string; total: number; count: number }>
  byPaymentMethod: Record<string, number>
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>
  profit: { sales: number; costOfGoods: number; gross: number; marginPct: number; expenses: number; net: number }
  comparison: {
    prevTotalSales: number
    prevTransactionCount: number
    prevNet: number
    salesChangePct: number | null
    countChangePct: number | null
    netChangePct: number | null
  }
}

export interface AbonoReceipt {
  type: 'cliente' | 'proveedor'
  name: string
  amount: number
  method: string
  balance: number
  date: string
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export const api = {
  // Catálogo
  products: (q = '', status = 'ACTIVE') =>
    get<{ products: Product[] }>(`/api/products?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  productsIn: (branchId?: string) =>
    get<{ products: Product[] }>(`/api/products${branchId ? `?branchId=${branchId}` : ''}`),
  createBranch: (name: string) => post<{ branch: Branch }>('/api/branches', { name }),
  updateBranch: (id: string, data: { name?: string; isActive?: boolean }) =>
    patch<{ branch: Branch & { isActive: boolean } }>(`/api/branches/${id}`, data),
  auditLogs: () =>
    get<{ logs: Array<{ id: string; action: string; entity: string; payload: Record<string, unknown> | null; user: string; createdAt: string }> }>(
      '/api/audit',
    ),
  importProducts: (rows: unknown[]) =>
    post<{ created: number; skipped: Array<{ name: string; reason: string }>; total: number }>(
      '/api/products/import',
      { rows },
    ),
  createProduct: (data: unknown) => post<{ product: Product }>('/api/products', data),
  updateProduct: (id: string, data: unknown) => patch<{ product: Product }>(`/api/products/${id}`, data),
  quotes: (params = '') => get<{ quotes: Quote[] }>(`/api/quotes${params}`),
  createQuote: (data: unknown) => post<{ quote: Quote }>('/api/quotes', data),
  updateQuote: (id: string, data: unknown) => patch<{ quote: Quote }>(`/api/quotes/${id}`, data),
  addVariants: (id: string, data: unknown) =>
    post<{ creadas: number; convertido: boolean }>(`/api/products/${id}/variants`, data),
  archiveProduct: (id: string) => del<{ ok: boolean }>(`/api/products/${id}`),

  categories: () => get<{ categories: Category[] }>('/api/categories'),
  createCategory: (name: string) => post<{ category: Category }>('/api/categories', { name }),
  deleteCategory: (id: string) => del<{ ok: boolean }>(`/api/categories/${id}`),

  suppliers: () => get<{ suppliers: Supplier[] }>('/api/suppliers'),
  createSupplier: (data: { name: string; phone?: string }) =>
    post<{ supplier: Supplier }>('/api/suppliers', data),
  updateSupplier: (id: string, data: { name?: string; phone?: string }) =>
    put<{ supplier: Supplier }>(`/api/suppliers/${id}`, data),
  deleteSupplier: (id: string) => del<{ ok: boolean }>(`/api/suppliers/${id}`),

  // Clientes
  customers: (q = '') =>
    get<{ customers: Customer[] }>(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  customerDetail: (id: string) =>
    get<{ customer: Customer & { sales: Sale[]; payments: Array<{ id: string; amount: number; method: string; createdAt: string }> } }>(
      `/api/customers/${id}`,
    ),
  createCustomer: (data: unknown) => post<{ customer: Customer }>('/api/customers', data),
  updateCustomer: (id: string, data: unknown) => put<{ customer: Customer }>(`/api/customers/${id}`, data),
  deleteCustomer: (id: string) => del<{ ok: boolean }>(`/api/customers/${id}`),
  payCustomer: (id: string, amount: number, method: string) =>
    post<{ receipt: AbonoReceipt; customer: Customer }>(`/api/customers/${id}/payments`, { amount, method }),

  // Ventas
  sales: (params = '') => get<{ sales: Sale[] }>(`/api/sales${params}`),
  createSale: (data: unknown) => post<{ sale: Sale }>('/api/sales', data),
  returnSale: (id: string, items: Array<{ saleItemId: string; quantity: number }>, exchange: boolean) =>
    post<{ return: { totalRefund: number }; creditForExchange: number }>(`/api/sales/${id}/return`, {
      items,
      exchange,
    }),
  voidSale: (id: string, reason?: string) =>
    post<{ sale: Sale; refund: number }>(`/api/sales/${id}/void`, { reason }),

  // Compras
  purchases: () => get<{ purchases: Purchase[] }>('/api/purchases'),
  createPurchase: (data: unknown) => post<{ purchase: Purchase }>('/api/purchases', data),
  payPurchase: (id: string, amount: number, method: string) =>
    post<{ receipt: AbonoReceipt; purchase: Purchase }>(`/api/purchases/${id}/payments`, { amount, method }),

  // Caja
  currentCashSession: () => get<CashSessionSummary>('/api/cash-registers/current'),
  openCashSession: (branchId: string, openingBalance: number) =>
    post<{ session: { id: string } }>('/api/cash-registers/open', { branchId, openingBalance }),
  closeCashSession: (
    id: string,
    data: { closingBalance: number; closingNotes?: string; openNext?: boolean; nextOpeningAmount?: number },
  ) =>
    post<{
      summary: {
        openingBalance: number
        salesTotal: number
        // Parte en efectivo de las ventas — lo único que suma al esperado del cajón
        cashSales: number
        incomes: number
        expenses: number
        expectedBalance: number
        countedBalance: number
        difference: number
      }
      report?: {
        salesCount: number
        byMethod: Record<string, number>
        creditSales?: ShiftStat
        customerPayments?: ShiftStat
        purchases?: ShiftStat
        supplierPayments?: ShiftStat
        returns?: ShiftStat
      }
      nextSession: { id: string } | null
    }>(`/api/cash-registers/${id}/close`, data),
  shifts: () => get<{ shifts: Shift[] }>('/api/shifts'),

  cashMovements: () =>
    get<{ movements: CashMovement[]; descriptions: { INCOME: string[]; EXPENSE: string[] } }>(
      '/api/cash-movements',
    ),
  createCashMovement: (data: { type: 'INCOME' | 'EXPENSE'; description: string; comment?: string; amount: number }) =>
    post<{ movement: CashMovement }>('/api/cash-movements', data),

  // Inventario
  adjustInventory: (adjustments: Array<{ productId: string; quantity: number }>) =>
    post<{ adjusted: number }>('/api/inventory/adjust', { adjustments }),
  transferInventory: (data: { productId: string; quantity: number; direction: 'in' | 'out' }) =>
    post<{ before: number; after: number }>('/api/inventory/transfer', data),

  // Esperas
  heldSales: () => get<{ heldSales: HeldSale[] }>('/api/held-sales'),
  createHeldSale: (data: { customerName?: string; itemCount: number; total: number; payload: HeldSalePayload }) =>
    post<{ heldSale: HeldSale }>('/api/held-sales', data),
  deleteHeldSale: (id: string) => del<{ ok: boolean }>(`/api/held-sales/${id}`),
  heldPurchases: () => get<{ heldPurchases: HeldPurchase[] }>('/api/held-purchases'),
  createHeldPurchase: (data: { supplierName?: string; total: number; payload: HeldPurchasePayload }) =>
    post<{ heldPurchase: HeldPurchase }>('/api/held-purchases', data),
  deleteHeldPurchase: (id: string) => del<{ ok: boolean }>(`/api/held-purchases/${id}`),

  // Usuarios y ajustes
  users: () => get<{ users: AppUser[] }>('/api/users'),
  createUser: (data: unknown) => post<{ user: AppUser }>('/api/users', data),
  updateUser: (id: string, data: unknown) => put<{ user: AppUser }>(`/api/users/${id}`, data),

  settings: () => get<{ settings: Settings }>('/api/settings'),
  // Pago del plan por Wompi
  crearPagoPlan: () =>
    post<{ url: string; reference: string; amount: number; gateway: string; sandbox: boolean }>('/api/plan/checkout'),
  estadoPagoPlan: (ref: string) =>
    get<{ status: string; paidAt: string | null; amount: number; plan: PlanInfo }>(
      `/api/plan/checkout?ref=${encodeURIComponent(ref)}`,
    ),
  updateSettings: (data: unknown) => put<{ settings: Settings }>('/api/settings', data),
  testNotification: () => post<{ enviado: boolean; destino: string }>('/api/notifications/test', {}),

  branches: () => get<{ branches: Branch[] }>('/api/branches'),

  // Reportes
  dailyReport: (date: string) => get<DailyReport>(`/api/reports/daily?date=${date}`),
  rangeReport: (from: string, to: string) => get<RangeReport>(`/api/reports/range?from=${from}&to=${to}`),

  // Contacto (envío directo por correo desde el sistema)
  sendContact: (data: { type: string; subject: string; message: string }) =>
    post<{ ok: boolean }>('/api/contact', data),
}
