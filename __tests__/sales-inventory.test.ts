/**
 * Integration tests: sale → stock decrement → movement recorded
 *
 * These tests use a real (test) database connection via the Prisma client.
 * Run with: DATABASE_URL=<test-db-url> npm test
 *
 * Each test cleans up its own data via the created IDs.
 */

import { db } from '../lib/db'
import { MovementType, PaymentMethod } from '@prisma/client'

// Helper: build a minimal business + branch + user + product + inventory
async function buildTestFixture(opts: { allowNegativeStock?: boolean; initialQty?: number; minStock?: number } = {}) {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  const business = await db.business.create({
    data: {
      name: `Test Business ${suffix}`,
      slug: `test-biz-${suffix}`,
      allowNegativeStock: opts.allowNegativeStock ?? false,
    },
  })

  const branch = await db.branch.create({
    data: { name: 'Main Branch', businessId: business.id },
  })

  const user = await db.user.create({
    data: {
      email: `cashier-${suffix}@test.com`,
      password: 'hashed',
      name: 'Test Cashier',
      role: 'CASHIER',
      businessId: business.id,
      branchId: branch.id,
    },
  })

  const cashSession = await db.cashSession.create({
    data: {
      openingBalance: 100,
      branchId: branch.id,
      openedById: user.id,
    },
  })

  const product = await db.product.create({
    data: {
      name: 'Test Product',
      price: 10.0,
      taxRate: 0.16,
      businessId: business.id,
    },
  })

  const inventory = await db.inventory.create({
    data: {
      productId: product.id,
      branchId: branch.id,
      quantity: opts.initialQty ?? 10,
      minStock: opts.minStock ?? 2,
      lowStock: (opts.initialQty ?? 10) <= (opts.minStock ?? 2),
    },
  })

  return { business, branch, user, cashSession, product, inventory }
}

// Helper: create a sale atomically (mirrors POST /api/sales logic)
async function createSale(
  fixture: Awaited<ReturnType<typeof buildTestFixture>>,
  quantity: number
) {
  const { business, branch, user, cashSession, product, inventory } = fixture

  return db.$transaction(async (tx) => {
    const folio = `V${Date.now()}`
    const unitPrice = Number(product.price)
    const taxRate = Number(product.taxRate)
    const itemSubtotal = unitPrice * quantity
    const itemTax = itemSubtotal * taxRate

    const sale = await tx.sale.create({
      data: {
        folio,
        subtotal: itemSubtotal,
        taxAmount: itemTax,
        discountAmount: 0,
        total: itemSubtotal + itemTax,
        paymentMethod: PaymentMethod.CASH,
        amountPaid: itemSubtotal + itemTax,
        changeGiven: 0,
        branchId: branch.id,
        cashierId: user.id,
        cashSessionId: cashSession.id,
      },
    })

    const saleItem = await tx.saleItem.create({
      data: {
        saleId: sale.id,
        productId: product.id,
        quantity,
        unitPrice,
        taxRate,
        taxAmount: itemTax,
        subtotal: itemSubtotal,
        total: itemSubtotal + itemTax,
      },
    })

    const currentInv = await tx.inventory.findUnique({
      where: { id: inventory.id },
    })
    const quantityBefore = currentInv!.quantity
    const quantityAfter = quantityBefore - quantity
    const isLowStock = quantityAfter <= currentInv!.minStock

    const updatedInv = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: quantityAfter, lowStock: isLowStock },
    })

    const movement = await tx.inventoryMovement.create({
      data: {
        type: MovementType.SALE,
        quantity,
        quantityBefore,
        quantityAfter,
        reason: `Venta ${folio}`,
        inventoryId: inventory.id,
        saleItemId: saleItem.id,
        createdById: user.id,
      },
    })

    return { sale, saleItem, updatedInv, movement }
  })
}

// Cleanup helper
async function cleanup(ids: {
  businessId: string
  branchId: string
  userId: string
  cashSessionId: string
  productId: string
  inventoryId: string
}) {
  await db.inventoryMovement.deleteMany({ where: { inventory: { branchId: ids.branchId } } })
  await db.saleItem.deleteMany({ where: { sale: { branchId: ids.branchId } } })
  await db.sale.deleteMany({ where: { branchId: ids.branchId } })
  await db.inventory.deleteMany({ where: { branchId: ids.branchId } })
  await db.cashSession.deleteMany({ where: { id: ids.cashSessionId } })
  await db.product.deleteMany({ where: { businessId: ids.businessId } })
  await db.user.deleteMany({ where: { businessId: ids.businessId } })
  await db.branch.deleteMany({ where: { businessId: ids.businessId } })
  await db.business.deleteMany({ where: { id: ids.businessId } })
}

describe('Sale → Stock decrement → Movement recorded', () => {
  it('decrements inventory atomically when a sale is created', async () => {
    const fixture = await buildTestFixture({ initialQty: 10, minStock: 2 })
    const { business, branch, user, cashSession, product, inventory } = fixture

    const { updatedInv, movement } = await createSale(fixture, 3)

    // Stock decremented correctly
    expect(updatedInv.quantity).toBe(7)

    // lowStock flag: 7 > 2, so should be false
    expect(updatedInv.lowStock).toBe(false)

    // Movement created with correct values
    expect(movement.type).toBe(MovementType.SALE)
    expect(movement.quantity).toBe(3)
    expect(movement.quantityBefore).toBe(10)
    expect(movement.quantityAfter).toBe(7)
    expect(movement.inventoryId).toBe(inventory.id)

    await cleanup({
      businessId: business.id,
      branchId: branch.id,
      userId: user.id,
      cashSessionId: cashSession.id,
      productId: product.id,
      inventoryId: inventory.id,
    })
  })

  it('sets lowStock=true when quantity falls to or below minStock', async () => {
    const fixture = await buildTestFixture({ initialQty: 5, minStock: 3 })
    const { business, branch, user, cashSession, product, inventory } = fixture

    // Sell 3 → quantity becomes 2, minStock=3, so 2 <= 3 → lowStock=true
    const { updatedInv } = await createSale(fixture, 3)

    expect(updatedInv.quantity).toBe(2)
    expect(updatedInv.lowStock).toBe(true)

    await cleanup({
      businessId: business.id,
      branchId: branch.id,
      userId: user.id,
      cashSessionId: cashSession.id,
      productId: product.id,
      inventoryId: inventory.id,
    })
  })

  it('sets lowStock=true when quantity reaches zero', async () => {
    const fixture = await buildTestFixture({ initialQty: 3, minStock: 0 })
    const { business, branch, user, cashSession, product, inventory } = fixture

    // Sell all 3 → quantity becomes 0, minStock=0, so 0 <= 0 → lowStock=true
    const { updatedInv } = await createSale(fixture, 3)

    expect(updatedInv.quantity).toBe(0)
    expect(updatedInv.lowStock).toBe(true)

    await cleanup({
      businessId: business.id,
      branchId: branch.id,
      userId: user.id,
      cashSessionId: cashSession.id,
      productId: product.id,
      inventoryId: inventory.id,
    })
  })

  it('links InventoryMovement to the SaleItem', async () => {
    const fixture = await buildTestFixture({ initialQty: 10 })
    const { business, branch, user, cashSession, product, inventory } = fixture

    const { saleItem, movement } = await createSale(fixture, 2)

    expect(movement.saleItemId).toBe(saleItem.id)

    await cleanup({
      businessId: business.id,
      branchId: branch.id,
      userId: user.id,
      cashSessionId: cashSession.id,
      productId: product.id,
      inventoryId: inventory.id,
    })
  })

  it('rolls back all changes if an error occurs mid-transaction', async () => {
    const fixture = await buildTestFixture({ initialQty: 5 })
    const { business, branch, user, cashSession, product, inventory } = fixture

    // Force an error by trying to create a movement with an invalid inventoryId
    await expect(
      db.$transaction(async (tx) => {
        await tx.sale.create({
          data: {
            folio: `V${Date.now()}`,
            subtotal: 10,
            taxAmount: 1.6,
            discountAmount: 0,
            total: 11.6,
            paymentMethod: PaymentMethod.CASH,
            amountPaid: 11.6,
            changeGiven: 0,
            branchId: branch.id,
            cashierId: user.id,
            cashSessionId: cashSession.id,
          },
        })

        // This should fail: invalid inventoryId
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.SALE,
            quantity: 1,
            quantityBefore: 5,
            quantityAfter: 4,
            inventoryId: 'invalid-id-that-does-not-exist',
            createdById: user.id,
          },
        })
      })
    ).rejects.toThrow()

    // Inventory should be unchanged
    const inv = await db.inventory.findUnique({ where: { id: inventory.id } })
    expect(inv?.quantity).toBe(5)

    // No sale created
    const sales = await db.sale.findMany({ where: { branchId: branch.id } })
    expect(sales).toHaveLength(0)

    await cleanup({
      businessId: business.id,
      branchId: branch.id,
      userId: user.id,
      cashSessionId: cashSession.id,
      productId: product.id,
      inventoryId: inventory.id,
    })
  })
})
