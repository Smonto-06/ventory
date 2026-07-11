/**
 * Integration tests (DB real) para los flujos nuevos del prototipo:
 *  - Compra: stock += qty, costo/precio nuevos, gasto de caja si es de contado
 *  - Compra a crédito: saldo pendiente + abono posterior (gasto de caja en efectivo)
 *  - Devolución: regresa stock, gasto de caja "Devolución"; cambio no toca caja
 *  - Anulación: regresa stock restante, gasto por lo no devuelto, marca anulada
 *  - Abono de cliente: baja saldo, ingreso de caja "Abono de cliente"
 *
 * Run with: DATABASE_URL=<test-db-url> npm test
 */

import { NextRequest } from 'next/server'
import { db } from '../../lib/db'

// Auth mockeado: las rutas usan getCurrentUser (JWT); aquí lo resolvemos al usuario del fixture
jest.mock('@/lib/get-session', () => ({
  getCurrentUser: jest.fn(),
}))
import { getCurrentUser } from '@/lib/get-session'

import { POST as createPurchase } from '@/app/api/purchases/route'
import { POST as payPurchase } from '@/app/api/purchases/[id]/payments/route'
import { POST as returnSale } from '@/app/api/sales/[id]/return/route'
import { POST as voidSale } from '@/app/api/sales/[id]/void/route'
import { POST as payCustomer } from '@/app/api/customers/[id]/payments/route'

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function buildFixture() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  const business = await db.business.create({
    data: { name: `Test Biz ${suffix}`, slug: `test-biz-${suffix}` },
  })
  const branch = await db.branch.create({
    data: { name: 'Principal', businessId: business.id },
  })
  const admin = await db.user.create({
    data: {
      email: `admin-${suffix}@test.com`,
      password: 'hashed',
      name: 'Admin Test',
      role: 'ADMIN',
      businessId: business.id,
      branchId: branch.id,
    },
  })
  const cashSession = await db.cashSession.create({
    data: { openingBalance: 1000000, branchId: branch.id, openedById: admin.id },
  })
  const product = await db.product.create({
    data: {
      name: `Producto ${suffix}`,
      price: 50000,
      cost: 30000,
      taxRate: 0,
      businessId: business.id,
    },
  })
  const inventory = await db.inventory.create({
    data: { productId: product.id, branchId: branch.id, quantity: 10, minStock: 2 },
  })
  const customer = await db.customer.create({
    data: { name: `Cliente ${suffix}`, businessId: business.id, balance: 80000 },
  })

  const sessionUser = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    businessId: business.id,
    businessName: business.name,
    businessSlug: business.slug,
  }

  return { business, branch, admin, cashSession, product, inventory, customer, sessionUser }
}

describe('Compras (POST /api/purchases)', () => {
  it('contado: incrementa stock, actualiza costo/precio/proveedor y genera gasto de caja', async () => {
    const f = await buildFixture()
    ;(getCurrentUser as jest.Mock).mockResolvedValue(f.sessionUser)

    const res = await createPurchase(
      makeRequest('/api/purchases', {
        supplierName: 'Distribuidora Nueva',
        method: 'CASH',
        items: [{ productId: f.product.id, quantity: 5, unitCost: 28000, newPrice: 55000 }],
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.purchase.total).toBe(140000)
    expect(body.purchase.balance).toBe(0)

    const inv = await db.inventory.findUnique({ where: { id: f.inventory.id } })
    expect(inv!.quantity).toBe(15)

    const product = await db.product.findUnique({ where: { id: f.product.id } })
    expect(Number(product!.cost)).toBe(28000)
    expect(Number(product!.price)).toBe(55000)
    expect(product!.supplier).toBe('Distribuidora Nueva')

    const movement = await db.cashMovement.findFirst({
      where: { cashSessionId: f.cashSession.id, description: 'Pago a proveedor' },
    })
    expect(movement).not.toBeNull()
    expect(Number(movement!.amount)).toBe(140000)
    expect(movement!.type).toBe('EXPENSE')
  })

  it('crédito: deja saldo pendiente y el abono posterior en efectivo genera gasto', async () => {
    const f = await buildFixture()
    ;(getCurrentUser as jest.Mock).mockResolvedValue(f.sessionUser)

    const res = await createPurchase(
      makeRequest('/api/purchases', {
        supplierName: 'Proveedor Crédito',
        method: 'CREDIT',
        initialPayment: 40000,
        items: [{ productId: f.product.id, quantity: 4, unitCost: 25000 }],
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.purchase.total).toBe(100000)
    expect(body.purchase.balance).toBe(60000)

    // El abono inicial de una compra a crédito no genera movimiento de caja (regla del prototipo)
    const movsBefore = await db.cashMovement.count({
      where: { cashSessionId: f.cashSession.id },
    })
    expect(movsBefore).toBe(0)

    // Abono posterior en efectivo → gasto "Pago a proveedor", con tope al saldo
    const payRes = await payPurchase(
      makeRequest(`/api/purchases/${body.purchase.id}/payments`, {
        amount: 999999,
        method: 'CASH',
      }),
      { params: { id: body.purchase.id } },
    )
    expect(payRes.status).toBe(201)
    const payBody = await payRes.json()
    expect(payBody.payment.amount).toBe(60000)
    expect(payBody.purchase.balance).toBe(0)
    expect(payBody.receipt.type).toBe('proveedor')

    const movement = await db.cashMovement.findFirst({
      where: { cashSessionId: f.cashSession.id, description: 'Pago a proveedor' },
    })
    expect(Number(movement!.amount)).toBe(60000)
  })
})

// Venta simple de contado creada directamente en DB (2 unidades × 50.000)
async function seedSale(f: Awaited<ReturnType<typeof buildFixture>>) {
  return db.sale.create({
    data: {
      folio: `F-${Date.now().toString().slice(-6)}`,
      subtotal: 100000,
      taxAmount: 0,
      discountAmount: 0,
      total: 100000,
      paymentMethod: 'CASH',
      amountPaid: 100000,
      changeGiven: 0,
      branchId: f.branch.id,
      cashierId: f.admin.id,
      cashSessionId: f.cashSession.id,
      items: {
        create: [
          {
            productId: f.product.id,
            quantity: 2,
            unitPrice: 50000,
            costPrice: 30000,
            taxRate: 0,
            taxAmount: 0,
            subtotal: 100000,
            total: 100000,
          },
        ],
      },
    },
    include: { items: true },
  })
}

describe('Devoluciones y anulación', () => {
  it('devolución: regresa stock, marca retQty y genera gasto "Devolución"', async () => {
    const f = await buildFixture()
    ;(getCurrentUser as jest.Mock).mockResolvedValue(f.sessionUser)
    const sale = await seedSale(f)

    const res = await returnSale(
      makeRequest(`/api/sales/${sale.id}/return`, {
        items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
        exchange: false,
      }),
      { params: { id: sale.id } },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.return.totalRefund).toBe(50000)
    expect(body.creditForExchange).toBe(0)

    const inv = await db.inventory.findUnique({ where: { id: f.inventory.id } })
    expect(inv!.quantity).toBe(11)

    const item = await db.saleItem.findUnique({ where: { id: sale.items[0].id } })
    expect(item!.returnedQty).toBe(1)

    const movement = await db.cashMovement.findFirst({
      where: { cashSessionId: f.cashSession.id, description: 'Devolución' },
    })
    expect(Number(movement!.amount)).toBe(50000)
  })

  it('cambio: regresa stock pero NO genera gasto; retorna crédito para descuento', async () => {
    const f = await buildFixture()
    ;(getCurrentUser as jest.Mock).mockResolvedValue(f.sessionUser)
    const sale = await seedSale(f)

    const res = await returnSale(
      makeRequest(`/api/sales/${sale.id}/return`, {
        items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
        exchange: true,
      }),
      { params: { id: sale.id } },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.creditForExchange).toBe(50000)

    const movs = await db.cashMovement.count({ where: { cashSessionId: f.cashSession.id } })
    expect(movs).toBe(0)
  })

  it('anulación tras devolución parcial: regresa stock restante y gasto por lo no devuelto', async () => {
    const f = await buildFixture()
    ;(getCurrentUser as jest.Mock).mockResolvedValue(f.sessionUser)
    const sale = await seedSale(f)

    // Devuelve 1 de 2 (gasto 50.000), luego anula (debe regresar 1 restante y gastar 50.000 más)
    await returnSale(
      makeRequest(`/api/sales/${sale.id}/return`, {
        items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
        exchange: false,
      }),
      { params: { id: sale.id } },
    )
    const res = await voidSale(makeRequest(`/api/sales/${sale.id}/void`, {}), {
      params: { id: sale.id },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.refund).toBe(50000)
    expect(body.sale.status).toBe('CANCELLED')

    const inv = await db.inventory.findUnique({ where: { id: f.inventory.id } })
    expect(inv!.quantity).toBe(12) // 10 − 0 (venta directa no descontó) +1 dev +1 anulación

    const voidMov = await db.cashMovement.findFirst({
      where: { cashSessionId: f.cashSession.id, description: 'Anulación de venta' },
    })
    expect(Number(voidMov!.amount)).toBe(50000)

    // No se puede anular dos veces
    const res2 = await voidSale(makeRequest(`/api/sales/${sale.id}/void`, {}), {
      params: { id: sale.id },
    })
    expect(res2.status).toBe(400)
  })
})

describe('Abono de cliente (POST /api/customers/[id]/payments)', () => {
  it('baja el saldo con tope, genera ingreso de caja en efectivo y emite recibo', async () => {
    const f = await buildFixture()
    ;(getCurrentUser as jest.Mock).mockResolvedValue(f.sessionUser)

    const res = await payCustomer(
      makeRequest(`/api/customers/${f.customer.id}/payments`, {
        amount: 999999,
        method: 'CASH',
      }),
      { params: { id: f.customer.id } },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.payment.amount).toBe(80000) // tope al saldo
    expect(body.customer.balance).toBe(0)
    expect(body.receipt.type).toBe('cliente')

    const movement = await db.cashMovement.findFirst({
      where: { cashSessionId: f.cashSession.id, description: 'Abono de cliente' },
    })
    expect(movement!.type).toBe('INCOME')
    expect(Number(movement!.amount)).toBe(80000)

    // Sin saldo, un nuevo abono es rechazado
    const res2 = await payCustomer(
      makeRequest(`/api/customers/${f.customer.id}/payments`, { amount: 1000, method: 'CASH' }),
      { params: { id: f.customer.id } },
    )
    expect(res2.status).toBe(400)
  })
})

afterAll(async () => {
  await db.$disconnect()
})
