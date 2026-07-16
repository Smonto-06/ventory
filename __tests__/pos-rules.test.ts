import {
  lineValue,
  cartSubtotal,
  saleTotal,
  resolvedDiscount,
  includedIva,
  resolvePayment,
  expectedBalance,
  cashPortion,
  refundForItems,
  priceFromMargin,
  marginFromPrice,
  profitReport,
} from '@/lib/pos'

describe('lineValue — precio × qty con descuento % por artículo', () => {
  it('sin descuento', () => {
    expect(lineValue({ unitPrice: 25000, quantity: 2 })).toBe(50000)
  })
  it('con 10% de descuento por artículo', () => {
    expect(lineValue({ unitPrice: 25000, quantity: 2, discountPct: 10 })).toBe(45000)
  })
  it('redondea al peso', () => {
    // 3333 × 1 × 0.85 = 2833.05 → 2833
    expect(lineValue({ unitPrice: 3333, quantity: 1, discountPct: 15 })).toBe(2833)
  })
})

describe('saleTotal — descuento global $ o %, nunca menor que 0', () => {
  const cart = [
    { unitPrice: 25000, quantity: 2 },
    { unitPrice: 10000, quantity: 1 },
  ]
  it('subtotal', () => {
    expect(cartSubtotal(cart)).toBe(60000)
  })
  it('descuento en $', () => {
    expect(saleTotal(cart, 5000, false)).toBe(55000)
  })
  it('descuento en %', () => {
    expect(saleTotal(cart, 10, true)).toBe(54000)
  })
  it('descuento mayor al subtotal no baja de 0', () => {
    expect(saleTotal(cart, 999999, false)).toBe(0)
  })
  it('resolvedDiscount tope al subtotal', () => {
    expect(resolvedDiscount(cart, 999999, false)).toBe(60000)
    expect(resolvedDiscount(cart, 10, true)).toBe(6000)
  })
})

describe('includedIva — IVA incluido en el precio (informativo)', () => {
  it('19% sobre 119.000 → 19.000', () => {
    expect(includedIva(119000, 19)).toBe(19000)
  })
  it('0% → 0', () => {
    expect(includedIva(100000, 0)).toBe(0)
  })
})

describe('resolvePayment — cobro combinado', () => {
  it('solo efectivo: cambio = recibido − total', () => {
    const r = resolvePayment(45000, { card: 0, transfer: 0, cashActive: true, received: 50000 })
    expect(r.cashDue).toBe(45000)
    expect(r.change).toBe(5000)
    expect(r.covered).toBe(true)
    expect(r.cashCollected).toBe(45000)
  })
  it('tarjeta + efectivo: el restante se cobra en efectivo', () => {
    const r = resolvePayment(80000, { card: 50000, transfer: 0, cashActive: true, received: 30000 })
    expect(r.cashDue).toBe(30000)
    expect(r.change).toBe(0)
    expect(r.covered).toBe(true)
  })
  it('no cubierto', () => {
    const r = resolvePayment(80000, { card: 20000, transfer: 0, cashActive: true, received: 10000 })
    expect(r.covered).toBe(false)
  })
  it('solo transferencia sin efectivo cubre exacto', () => {
    const r = resolvePayment(80000, { card: 0, transfer: 80000, cashActive: false, received: 0 })
    expect(r.covered).toBe(true)
    expect(r.change).toBe(0)
    expect(r.cashCollected).toBe(0)
  })
})

describe('expectedBalance — saldo esperado de caja', () => {
  it('apertura + ventas en efectivo + ingresos − gastos', () => {
    expect(expectedBalance(1000000, 350000, 50000, 120000)).toBe(1280000)
  })
})

describe('cashPortion — efectivo que entra al cajón por una venta', () => {
  it('venta en efectivo: el pago CASH ya viene neto de cambio', () => {
    expect(cashPortion({ total: 65000, paymentMethod: 'CASH', payments: [{ method: 'CASH', amount: 65000 }] })).toBe(65000)
  })
  it('tarjeta o transferencia no ponen billetes en el cajón', () => {
    expect(cashPortion({ total: 50000, paymentMethod: 'CARD', payments: [{ method: 'CARD', amount: 50000 }] })).toBe(0)
    expect(cashPortion({ total: 50000, paymentMethod: 'TRANSFER', payments: [{ method: 'TRANSFER', amount: 50000 }] })).toBe(0)
  })
  it('crédito no aporta efectivo al momento de la venta', () => {
    expect(cashPortion({ total: 45000, paymentMethod: 'CREDIT', payments: [{ method: 'CREDIT', amount: 45000 }] })).toBe(0)
  })
  it('pago combinado: solo la parte en efectivo', () => {
    expect(
      cashPortion({
        total: 50000,
        paymentMethod: 'MIXED',
        payments: [
          { method: 'CARD', amount: 30000 },
          { method: 'CASH', amount: 20000 },
        ],
      }),
    ).toBe(20000)
  })
  it('venta antigua sin registro de pagos: solo CASH aporta el total', () => {
    expect(cashPortion({ total: 40000, paymentMethod: 'CASH' })).toBe(40000)
    expect(cashPortion({ total: 40000, paymentMethod: 'CARD' })).toBe(0)
  })
})

describe('refundForItems — devoluciones con tope qty − retQty', () => {
  it('reembolso proporcional por unidad', () => {
    // línea de 2 unidades por 45.000 (con dsc) → unitario 22.500; devuelve 1
    expect(
      refundForItems([{ lineTotal: 45000, quantity: 2, returnedQty: 0, toReturn: 1 }]),
    ).toBe(22500)
  })
  it('no devuelve más de lo disponible', () => {
    expect(
      refundForItems([{ lineTotal: 45000, quantity: 2, returnedQty: 1, toReturn: 5 }]),
    ).toBe(22500)
  })
  it('cero si ya se devolvió todo', () => {
    expect(
      refundForItems([{ lineTotal: 45000, quantity: 2, returnedQty: 2, toReturn: 1 }]),
    ).toBe(0)
  })
})

describe('margen ↔ precio (línea de compra)', () => {
  it('priceFromMargin', () => {
    expect(priceFromMargin(10000, 50)).toBe(15000)
  })
  it('marginFromPrice', () => {
    expect(marginFromPrice(10000, 15000)).toBe(50)
  })
  it('margen 0 si costo 0', () => {
    expect(marginFromPrice(0, 15000)).toBe(0)
  })
})

describe('profitReport — utilidad de reportes', () => {
  it('ventas − costo = utilidad; − gastos = neta; margen %', () => {
    const r = profitReport(200000, 120000, 30000)
    expect(r.gross).toBe(80000)
    expect(r.marginPct).toBe(40)
    expect(r.net).toBe(50000)
  })
  it('sin ventas margen 0', () => {
    expect(profitReport(0, 0, 10000).marginPct).toBe(0)
  })
})
