export const DIFFERENCE_THRESHOLD_DEFAULT = 5000 // COP

export interface CloseCalculation {
  openingBalance: number
  cashSales: number
  expenses: number
  withdrawals: number
  expectedBalance: number
  closingBalance: number
  difference: number
}

/**
 * Calculate expected cash balance at session close.
 * expectedBalance = openingBalance + cashSales - expenses - withdrawals
 * difference = closingBalance - expectedBalance (positive = surplus, negative = shortage)
 */
export function calculateCloseBalance(
  openingBalance: number,
  cashSales: number,
  expenses: number,
  withdrawals: number,
  closingBalance: number,
): CloseCalculation {
  const expectedBalance = openingBalance + cashSales - expenses - withdrawals
  const difference = closingBalance - expectedBalance
  return { openingBalance, cashSales, expenses, withdrawals, expectedBalance, closingBalance, difference }
}

export function requiresObservation(
  difference: number,
  threshold = DIFFERENCE_THRESHOLD_DEFAULT,
): boolean {
  return Math.abs(difference) > threshold
}

export interface ShiftCloseCalculation {
  openingBalance: number
  /** Ventas EN EFECTIVO del turno no anuladas — lo único que entra al cajón */
  salesTotal: number
  incomes: number
  expenses: number
  expectedBalance: number
  countedBalance: number
  difference: number
}

/**
 * Cierre de turno (conteo físico del cajón):
 * esperado = apertura + ventas en efectivo + ingresos − gastos
 * diferencia = contado − esperado
 * Tarjeta, transferencia y crédito no entran al cajón y no cuentan aquí.
 */
export function calculateShiftClose(
  openingBalance: number,
  salesTotal: number,
  incomes: number,
  expenses: number,
  countedBalance: number,
): ShiftCloseCalculation {
  const expectedBalance = openingBalance + salesTotal + incomes - expenses
  return {
    openingBalance,
    salesTotal,
    incomes,
    expenses,
    expectedBalance,
    countedBalance,
    difference: countedBalance - expectedBalance,
  }
}
