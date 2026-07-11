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
 * Saldo esperado de caja = apertura + ventas del turno + ingresos − gastos.
 * Solo ventas del turno actual no anuladas cuentan (el prototipo suma TODAS las
 * ventas del turno, sin importar el método de pago).
 */
export function expectedBalance(
  opening: number,
  shiftSalesTotal: number,
  incomes: number,
  expenses: number,
): number {
  return opening + shiftSalesTotal + incomes - expenses
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
