import {
  calculateCloseBalance,
  requiresObservation,
  DIFFERENCE_THRESHOLD_DEFAULT,
} from '@/lib/cash-session'

describe('calculateCloseBalance', () => {
  it('computes expected balance from opening + cashSales - expenses - withdrawals', () => {
    const result = calculateCloseBalance(100_000, 50_000, 5_000, 10_000, 130_000)
    expect(result.expectedBalance).toBe(135_000)
  })

  it('returns negative difference when counted < expected (faltante)', () => {
    const result = calculateCloseBalance(100_000, 50_000, 0, 0, 140_000)
    expect(result.difference).toBe(-10_000)
  })

  it('returns positive difference when counted > expected (sobrante)', () => {
    const result = calculateCloseBalance(100_000, 50_000, 0, 0, 160_000)
    expect(result.difference).toBe(10_000)
  })

  it('returns zero difference when counted matches expected exactly', () => {
    const result = calculateCloseBalance(50_000, 30_000, 0, 0, 80_000)
    expect(result.difference).toBe(0)
    expect(result.expectedBalance).toBe(80_000)
  })

  it('subtracts both expenses and withdrawals from expected', () => {
    const result = calculateCloseBalance(200_000, 100_000, 15_000, 25_000, 250_000)
    // expected = 200000 + 100000 - 15000 - 25000 = 260000
    expect(result.expectedBalance).toBe(260_000)
    expect(result.difference).toBe(-10_000)
  })

  it('includes all fields in the returned object', () => {
    const result = calculateCloseBalance(10_000, 5_000, 1_000, 2_000, 12_000)
    expect(result).toMatchObject({
      openingBalance: 10_000,
      cashSales: 5_000,
      expenses: 1_000,
      withdrawals: 2_000,
      expectedBalance: 12_000,
      closingBalance: 12_000,
      difference: 0,
    })
  })
})

describe('requiresObservation', () => {
  it('requires observation when absolute difference exceeds default threshold', () => {
    expect(requiresObservation(DIFFERENCE_THRESHOLD_DEFAULT + 1)).toBe(true)
    expect(requiresObservation(-(DIFFERENCE_THRESHOLD_DEFAULT + 1))).toBe(true)
  })

  it('does not require observation when difference is within threshold', () => {
    expect(requiresObservation(DIFFERENCE_THRESHOLD_DEFAULT)).toBe(false)
    expect(requiresObservation(-DIFFERENCE_THRESHOLD_DEFAULT)).toBe(false)
    expect(requiresObservation(0)).toBe(false)
  })

  it('uses custom threshold when provided', () => {
    expect(requiresObservation(1_500, 1_000)).toBe(true)
    expect(requiresObservation(500, 1_000)).toBe(false)
  })

  it('handles exact threshold boundary (not strictly over)', () => {
    expect(requiresObservation(5_000)).toBe(false)
    expect(requiresObservation(5_001)).toBe(true)
  })
})
