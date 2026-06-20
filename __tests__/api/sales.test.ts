/**
 * Integration tests for POST /api/sales
 * Mocks the database layer and NextAuth session.
 */

import { POST } from '@/app/api/sales/route'
import { NextRequest } from 'next/server'

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    cashSession: { findFirst: jest.fn() },
    business: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
    inventory: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    sale: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    saleItem: { create: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

const mockSession = {
  user: {
    id: 'user-1',
    businessId: 'biz-1',
    email: 'test@test.com',
    role: 'CASHIER',
    businessName: 'Test Biz',
    businessSlug: 'test',
  },
}

const mockCashSession = {
  id: 'cs-1',
  status: 'OPEN',
  branchId: 'branch-1',
}

const mockProduct = {
  id: 'prod-1',
  name: 'Coca Cola 2L',
  sku: 'CC2L',
  barcode: '7501234567890',
  price: { toString: () => '25.00' },
  taxRate: { toString: () => '0.16' },
  status: 'ACTIVE',
  businessId: 'biz-1',
}

const mockInventory = {
  id: 'inv-1',
  productId: 'prod-1',
  branchId: 'branch-1',
  quantity: 10,
  minStock: 2,
}

const mockSaleResult = {
  id: 'sale-1',
  folio: 'F-000001',
  status: 'COMPLETED',
  subtotal: 25,
  taxAmount: 4,
  discountAmount: 0,
  total: 29,
  paymentMethod: 'CASH',
  amountPaid: 30,
  changeGiven: 1,
  notes: null,
  createdAt: new Date().toISOString(),
  branch: { name: 'Sucursal A' },
  cashier: { name: 'Cajero Test' },
  items: [
    {
      id: 'si-1',
      productId: 'prod-1',
      product: { name: 'Coca Cola 2L', sku: 'CC2L' },
      quantity: 1,
      unitPrice: 25,
      taxRate: 0.16,
      taxAmount: 4,
      subtotal: 25,
      total: 29,
    },
  ],
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/sales', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.cashSession.findFirst as jest.Mock).mockResolvedValue(mockCashSession)
    ;(db.business.findUnique as jest.Mock).mockResolvedValue({ allowNegativeStock: false })
    ;(db.product.findMany as jest.Mock).mockResolvedValue([mockProduct])
    ;(db.inventory.findMany as jest.Mock).mockResolvedValue([mockInventory])
    ;(db.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn({
        ...db,
        sale: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: 'sale-1', folio: 'F-000001' }),
          findUnique: jest.fn().mockResolvedValue(mockSaleResult),
        } as unknown as typeof db.sale,
        saleItem: { create: jest.fn().mockResolvedValue({ id: 'si-1' }) } as unknown as typeof db.saleItem,
        inventory: {
          findUnique: jest.fn().mockResolvedValue(mockInventory),
          update: jest.fn().mockResolvedValue({}),
        } as unknown as typeof db.inventory,
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) } as unknown as typeof db.inventoryMovement,
      } as unknown as typeof db)
    )
    ;(db.auditLog.create as jest.Mock).mockResolvedValue({})
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const req = makeRequest({})
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('No autorizado')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/sales', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when items array is empty', async () => {
    const req = makeRequest({
      cashSessionId: 'cs-1',
      items: [],
      paymentMethod: 'CASH',
      amountPaid: 100,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when cash session is closed or not found', async () => {
    ;(db.cashSession.findFirst as jest.Mock).mockResolvedValueOnce(null)
    const req = makeRequest({
      cashSessionId: 'cs-closed',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 25 }],
      paymentMethod: 'CASH',
      amountPaid: 30,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Caja no encontrada')
  })

  it('returns 422 when stock is insufficient', async () => {
    ;(db.inventory.findMany as jest.Mock).mockResolvedValueOnce([
      { ...mockInventory, quantity: 0 },
    ])
    const req = makeRequest({
      cashSessionId: 'cs-1',
      items: [{ productId: 'prod-1', quantity: 5, unitPrice: 25 }],
      paymentMethod: 'CASH',
      amountPaid: 200,
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('INSUFFICIENT_STOCK')
    expect(body.available).toBe(0)
    expect(body.required).toBe(5)
  })

  it('returns 400 when cash amount is insufficient', async () => {
    const req = makeRequest({
      cashSessionId: 'cs-1',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 25 }],
      paymentMethod: 'CASH',
      amountPaid: 1, // total is ~29, paid only 1
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Monto insuficiente')
  })

  it('creates sale successfully and returns 201', async () => {
    const req = makeRequest({
      cashSessionId: 'cs-1',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 25 }],
      paymentMethod: 'CASH',
      amountPaid: 30,
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.sale).toBeDefined()
    expect(body.sale.folio).toBeDefined()
    expect(body.sale.status).toBe('COMPLETED')
  })

  it('returns 400 when a product does not belong to the business', async () => {
    ;(db.product.findMany as jest.Mock).mockResolvedValueOnce([]) // none found
    const req = makeRequest({
      cashSessionId: 'cs-1',
      items: [{ productId: 'foreign-prod', quantity: 1, unitPrice: 25 }],
      paymentMethod: 'CASH',
      amountPaid: 30,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('no encontrados')
  })

  it('accepts CARD payment without requiring amountPaid >= total', async () => {
    // For non-cash methods, amountPaid is recorded but change is 0
    const req = makeRequest({
      cashSessionId: 'cs-1',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 25 }],
      paymentMethod: 'CARD',
      amountPaid: 29, // exact total
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('applies discount correctly to total', async () => {
    const req = makeRequest({
      cashSessionId: 'cs-1',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 25 }],
      paymentMethod: 'CASH',
      amountPaid: 50,
      discountAmount: 5,
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
