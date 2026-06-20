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
