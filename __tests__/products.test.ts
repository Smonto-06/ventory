// Mock next-auth before importing routes
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/db', () => ({
  db: {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    inventory: {
      create: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { GET as getProducts, POST as postProduct } from '@/app/api/products/route'
import { GET as getProduct, PATCH as patchProduct, DELETE as deleteProduct } from '@/app/api/products/[id]/route'
import { GET as getCategories, POST as postCategory } from '@/app/api/categories/route'

const mockSession = {
  user: {
    id: 'user-1',
    email: 'admin@test.com',
    role: 'ADMIN' as const,
    businessId: 'biz-1',
    businessName: 'Test Business',
    businessSlug: 'test-business',
  },
}

const mockInventory = [{ quantity: 50, minStock: 10, branchId: 'branch-1' }]

const mockProduct = {
  id: 'prod-1',
  sku: 'SKU001',
  name: 'Coca Cola 600ml',
  description: null,
  barcode: '7501055300105',
  price: 18.5,
  cost: 12.0,
  taxRate: 0.16,
  unitOfMeasure: 'pieza',
  supplier: 'Distribuidor ARCA',
  status: 'ACTIVE' as const,
  businessId: 'biz-1',
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'Bebidas' },
  inventory: mockInventory,
  createdAt: new Date('2026-06-20'),
  updatedAt: new Date('2026-06-20'),
}

function makeGetRequest(searchParams?: Record<string, string>): Request {
  const url = searchParams
    ? `http://localhost/api/products?${new URLSearchParams(searchParams)}`
    : 'http://localhost/api/products'
  return new Request(url)
}

function makePostRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatchRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── GET /api/products ───────────────────────────────────────────────────────

describe('GET /api/products', () => {
  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await getProducts(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns product list scoped to businessId', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.findMany as jest.Mock).mockResolvedValue([mockProduct])
    const res = await getProducts(makeGetRequest())
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.products).toHaveLength(1)
    expect(data.products[0].name).toBe('Coca Cola 600ml')
    expect(data.products[0].stock).toBe(50)
    expect((db.product.findMany as jest.Mock).mock.calls[0][0].where.businessId).toBe('biz-1')
  })

  it('applies name search filter', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.findMany as jest.Mock).mockResolvedValue([])
    await getProducts(makeGetRequest({ q: 'coca' }))
    const call = (db.product.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where.OR).toBeDefined()
    expect(call.where.OR[0]).toMatchObject({ name: { contains: 'coca', mode: 'insensitive' } })
  })

  it('applies barcode search filter', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.findMany as jest.Mock).mockResolvedValue([])
    await getProducts(makeGetRequest({ q: '7501055300105' }))
    const call = (db.product.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where.OR[1]).toMatchObject({ barcode: { contains: '7501055300105', mode: 'insensitive' } })
  })
})

// ─── POST /api/products ──────────────────────────────────────────────────────

describe('POST /api/products', () => {
  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await postProduct(makePostRequest('http://localhost/api/products', { name: 'Test', price: 10 }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for CASHIER role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      ...mockSession,
      user: { ...mockSession.user, role: 'CASHIER' },
    })
    const res = await postProduct(makePostRequest('http://localhost/api/products', { name: 'Test', price: 10 }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when price is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await postProduct(makePostRequest('http://localhost/api/products', { name: 'Test' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when cost exceeds price', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await postProduct(
      makePostRequest('http://localhost/api/products', { name: 'Test', price: 10, cost: 20 })
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('costo')
  })

  it('creates product and returns 201', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.create as jest.Mock).mockResolvedValue({ ...mockProduct, inventory: [] })
    const res = await postProduct(
      makePostRequest('http://localhost/api/products', { name: 'Coca Cola', price: 18.5, cost: 12.0 })
    )
    expect(res.status).toBe(201)
  })
})

// ─── PATCH /api/products/[id] ────────────────────────────────────────────────

describe('PATCH /api/products/:id', () => {
  const params = { params: { id: 'prod-1' } }

  it('returns 404 when product not in business', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await patchProduct(makePatchRequest('http://localhost/api/products/prod-1', { name: 'New' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when updated cost exceeds price', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.findFirst as jest.Mock).mockResolvedValue({ ...mockProduct, price: 10, cost: null })
    const res = await patchProduct(
      makePatchRequest('http://localhost/api/products/prod-1', { price: 5, cost: 10 }),
      params
    )
    expect(res.status).toBe(400)
  })

  it('updates product successfully', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.findFirst as jest.Mock).mockResolvedValue(mockProduct)
    ;(db.product.update as jest.Mock).mockResolvedValue({ ...mockProduct, name: 'Updated Name' })
    const res = await patchProduct(
      makePatchRequest('http://localhost/api/products/prod-1', { name: 'Updated Name' }),
      params
    )
    expect(res.status).toBe(200)
  })
})

// ─── DELETE /api/products/[id] ───────────────────────────────────────────────

describe('DELETE /api/products/:id', () => {
  const params = { params: { id: 'prod-1' } }

  it('returns 403 for SUPERVISOR role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      ...mockSession,
      user: { ...mockSession.user, role: 'SUPERVISOR' },
    })
    const res = await deleteProduct(
      new Request('http://localhost/api/products/prod-1', { method: 'DELETE' }),
      params
    )
    expect(res.status).toBe(403)
  })

  it('archives product by setting status ARCHIVED', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.product.findFirst as jest.Mock).mockResolvedValue(mockProduct)
    ;(db.product.update as jest.Mock).mockResolvedValue({ ...mockProduct, status: 'ARCHIVED' })
    const res = await deleteProduct(
      new Request('http://localhost/api/products/prod-1', { method: 'DELETE' }),
      params
    )
    expect(res.status).toBe(200)
    expect((db.product.update as jest.Mock).mock.calls[0][0].data.status).toBe('ARCHIVED')
  })
})

// ─── GET /api/categories ─────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await getCategories()
    expect(res.status).toBe(401)
  })

  it('returns category list scoped to businessId', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.category.findMany as jest.Mock).mockResolvedValue([
      { id: 'cat-1', name: 'Bebidas', description: null, createdAt: new Date() },
    ])
    const res = await getCategories()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.categories).toHaveLength(1)
    expect((db.category.findMany as jest.Mock).mock.calls[0][0].where.businessId).toBe('biz-1')
  })
})

// ─── POST /api/categories ────────────────────────────────────────────────────

describe('POST /api/categories', () => {
  it('returns 409 for duplicate name', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.category.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1', name: 'Bebidas' })
    const res = await postCategory(
      makePostRequest('http://localhost/api/categories', { name: 'Bebidas' })
    )
    expect(res.status).toBe(409)
  })

  it('creates category successfully', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(db.category.findUnique as jest.Mock).mockResolvedValue(null)
    ;(db.category.create as jest.Mock).mockResolvedValue({
      id: 'cat-2',
      name: 'Lacteos',
      description: null,
      createdAt: new Date(),
    })
    const res = await postCategory(
      makePostRequest('http://localhost/api/categories', { name: 'Lacteos' })
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.category.name).toBe('Lacteos')
  })
})
