// Reglas de negocio del POS — réplica exacta de los cálculos del prototipo
// (Ventory POS.dc.html). Dinero en pesos colombianos enteros (sin decimales).
// Mantener toda la aritmética de venta/caja aquí para que no se duplique.

export interface CartLine {
  unitPrice: number
  quantity: number
  /** Descuento por artículo en % (0–100) */
  discountPct?: number
}

/** Valor de una línea: precio × cantidad × (1 − dscPct/100), redondeado */
export function lineValue(line: CartLine): number {
  const pct = line.discountPct ?? 0
  return Math.round(line.unitPrice * line.quantity * (1 - pct / 100))
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineValue(l), 0)
}

/**
 * Total de la venta con descuento global en $ o en %.
 * El descuento es excluyente ($ o %) y el total nunca baja de 0.
 */
export function saleTotal(lines: CartLine[], discount: number, discountIsPct: boolean): number {
  const subtotal = cartSubtotal(lines)
  const d = discountIsPct ? Math.round((subtotal * (discount || 0)) / 100) : discount || 0
  return Math.max(0, subtotal - d)
}

/** Monto del descuento global ya resuelto en $ */
export function resolvedDiscount(lines: CartLine[], discount: number, discountIsPct: boolean): number {
  const subtotal = cartSubtotal(lines)
  const d = discountIsPct ? Math.round((subtotal * (discount || 0)) / 100) : discount || 0
  return Math.min(subtotal, Math.max(0, d))
}

/**
 * IVA incluido en el precio — desglose informativo:
 * iva = total × pct / (100 + pct)
 */
export function includedIva(total: number, ivaPct: number): number {
  if (!ivaPct || ivaPct <= 0) return 0
  return Math.round((total * ivaPct) / (100 + ivaPct))
}

export interface PaymentSplit {
  /** Montos por método no-efectivo (tarjeta/transferencia) */
  card: number
  transfer: number
  /** true si el método efectivo está activo */
  cashActive: boolean
  /** Efectivo recibido (teclado de billetes) */
  received: number
}

export interface PaymentResolution {
  /** Lo que falta cubrir en efectivo tras los métodos no-efectivo */
  cashDue: number
  /** Cambio a devolver = recibido − restante en efectivo */
  change: number
  /** true si los pagos cubren el total */
  covered: boolean
  /** Monto efectivamente cobrado en efectivo (sin el cambio) */
  cashCollected: number
}

/**
 * Cobro combinado: Efectivo/Tarjeta/Transferencia se combinan; cada no-efectivo
 * lleva monto y el restante se cobra en efectivo. Crédito es exclusivo (no pasa por aquí).
 */
export function resolvePayment(total: number, split: PaymentSplit): PaymentResolution {
  const nonCash = Math.max(0, split.card || 0) + Math.max(0, split.transfer || 0)
  const cashDue = split.cashActive ? Math.max(0, total - nonCash) : 0
  const covered = nonCash + (split.cashActive ? split.received || 0 : 0) >= total
  const change = split.cashActive ? Math.max(0, (split.received || 0) - cashDue) : 0
  return { cashDue, change, covered, cashCollected: covered ? cashDue : 0 }
}

/**
 * Efectivo que entró al cajón por una venta: la suma de sus pagos en efectivo
 * (ya neta de cambio, porque el pago CASH se registra por lo aplicado al total).
 * Tarjeta, transferencia y crédito no ponen billetes en el cajón.
 */
export function cashPortion(sale: {
  total: number
  paymentMethod: string
  // amount admite Decimal de Prisma (se normaliza con Number())
  payments?: Array<{ method: string; amount: number | { toString(): string } }>
}): number {
  if (sale.payments && sale.payments.length > 0) {
    return sale.payments
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0)
  }
  // Ventas antiguas sin registro de pagos: solo el método CASH aporta efectivo
  return sale.paymentMethod === 'CASH' ? Number(sale.total) : 0
}

/**
 * Saldo esperado del cajón = apertura + ventas EN EFECTIVO del turno + ingresos − gastos.
 * Solo cuenta el efectivo físico: las ventas con tarjeta, transferencia o crédito
 * no entran al cajón y sumarlas produciría un "faltante" ficticio en cada cierre.
 * Solo ventas del turno actual no anuladas cuentan.
 */
export function expectedBalance(
  opening: number,
  shiftCashSales: number,
  incomes: number,
  expenses: number,
): number {
  return opening + shiftCashSales + incomes - expenses
}

/**
 * Reparte `total` proporcionalmente entre `weights` sin perder ni inventar
 * un peso: cada parte se redondea hacia abajo y el residuo entero (siempre
 * menor que la cantidad de partes) se reparte de a un peso a las partes con
 * mayor resto fraccionario, empate roto por id — así la función es
 * determinística sin importar el orden de entrada, y la suma de las partes
 * siempre da exactamente `total`. Se usa para prorratear el descuento
 * global de una venta entre sus líneas (return/route.ts): sin este reparto,
 * redondear cada línea por separado podía dejar $1-2 cobrados de más que
 * nunca quedaban disponibles para devolver, aunque se devolviera TODA la venta.
 */
export function allocateProportional(
  total: number,
  weights: Array<{ id: string; weight: number }>,
): Map<string, number> {
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0)
  const out = new Map<string, number>()
  if (totalWeight <= 0) {
    weights.forEach((w) => out.set(w.id, 0))
    return out
  }
  const parts = weights.map((w) => {
    const exact = (total * w.weight) / totalWeight
    const floor = Math.floor(exact)
    return { id: w.id, floor, remainder: exact - floor }
  })
  let leftover = total - parts.reduce((s, p) => s + p.floor, 0)
  parts.sort((a, b) => b.remainder - a.remainder || (a.id < b.id ? -1 : 1))
  for (const p of parts) {
    const extra = leftover > 0 ? 1 : 0
    if (extra) leftover--
    out.set(p.id, p.floor + extra)
  }
  return out
}

/**
 * Valor neto de una venta para reportes de utilidad: lo vendido menos lo
 * devuelto, CON el descuento global ya prorrateado. SaleItem.total se
 * guarda antes del descuento global de la venta (solo vive en
 * Sale.discountAmount/Sale.total) — sumarlo tal cual sobreestima ventas y
 * utilidad en el monto de cada descuento aplicado. Se prorratea con la
 * misma razón sale.total/sale.subtotal que usa return/route.ts.
 */
export function netSaleValue(sale: {
  subtotal: number
  total: number
  items: Array<{ total: number; quantity: number; returnedQty: number }>
}): number {
  const keptSubtotal = sale.items.reduce((a, i) => {
    const kept = i.quantity - i.returnedQty
    if (kept <= 0) return a
    return a + (kept >= i.quantity ? i.total : Math.round((i.total * kept) / i.quantity))
  }, 0)
  return sale.subtotal > 0 ? Math.round((keptSubtotal * sale.total) / sale.subtotal) : keptSubtotal
}

/** Reembolso de una devolución: valor unitario de línea (val/qty redondeado) × cantidad devuelta */
export function refundForItems(
  items: Array<{ lineTotal: number; quantity: number; returnedQty: number; toReturn: number }>,
): number {
  return items.reduce((sum, it) => {
    const available = it.quantity - (it.returnedQty || 0)
    const q = Math.min(Math.max(0, it.toReturn), available)
    if (q <= 0) return sum
    return sum + Math.round(it.lineTotal / it.quantity) * q
  }, 0)
}

/** % de ganancia ↔ precio de venta (línea de compra): price = cost × (1 + pct/100) */
export function priceFromMargin(unitCost: number, marginPct: number): number {
  return Math.round(unitCost * (1 + marginPct / 100))
}

export function marginFromPrice(unitCost: number, price: number): number {
  if (unitCost <= 0) return 0
  return Math.round((price / unitCost - 1) * 100)
}

/** Utilidad de reportes: ventas − costo de lo vendido; neta = utilidad − gastos */
export function profitReport(salesTotal: number, costOfGoods: number, expenses: number) {
  const gross = salesTotal - costOfGoods
  const marginPct = salesTotal > 0 ? Math.round((gross / salesTotal) * 100) : 0
  return { gross, marginPct, net: gross - expenses }
}

/**
 * Rango del día colombiano (UTC-5) que contiene el instante dado, expresado
 * en UTC. El servidor (Vercel) corre en UTC: usar los getters locales de
 * Date (getFullYear/getMonth/getDate) para "hoy" da la fecha en UTC, no en
 * Colombia — una venta después de las 7 p.m. Colombia (medianoche UTC)
 * aparecía contada en el reporte del día SIGUIENTE.
 */
export function diaColombiano(referencia: Date): { desde: Date; hasta: Date; etiqueta: Date } {
  const OFFSET_MIN = 5 * 60
  const local = new Date(referencia.getTime() - OFFSET_MIN * 60_000)
  const inicioLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const desde = new Date(inicioLocal + OFFSET_MIN * 60_000)
  const hasta = new Date(desde.getTime() + 86_400_000)
  return { desde, hasta, etiqueta: new Date(inicioLocal) }
}

/** Igual que diaColombiano(), pero para una fecha calendario explícita "YYYY-MM-DD" (ej. el selector de fecha de Reportes) */
export function diaColombianoDeFecha(fechaISO: string): { desde: Date; hasta: Date } {
  const OFFSET_MIN = 5 * 60
  const [y, m, d] = fechaISO.split('-').map(Number)
  const desde = new Date(Date.UTC(y, m - 1, d) + OFFSET_MIN * 60_000)
  const hasta = new Date(desde.getTime() + 86_400_000)
  return { desde, hasta }
}

/**
 * Gasto de caja que en realidad es el reembolso de una venta ya excluida (o
 * neteada) del total de ventas del reporte — "Devolución" o "Anulación de
 * venta" (ver return/route.ts y void/route.ts, únicos lugares que usan
 * exactamente estas descripciones). Sin filtrarlo, la utilidad neta de
 * reportes/resumen-diario lo restaba DOS veces: una porque la venta ya no
 * aporta ingreso/costo (netSaleValue la neta, o el void la excluye entera),
 * y otra de nuevo como "gasto operativo". Este filtro es solo para la
 * utilidad del reporte — el arqueo de caja (expectedBalance/cierre de
 * turno) sigue contando el movimiento completo, porque ese efectivo sí
 * salió físicamente del cajón.
 */
export function isSaleRefundExpense(description: string): boolean {
  return description === 'Devolución' || description === 'Anulación de venta'
}

export const CASH_MOVEMENT_DESCRIPTIONS = {
  INCOME: ['Base de caja', 'Abono de cliente', 'Otro ingreso'],
  EXPENSE: [
    'Pago a proveedor',
    'Servicios públicos',
    'Domicilios',
    'Devolución',
    'Anulación de venta',
    'Otro gasto',
  ],
} as const
