import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { PaymentMethod, CashSessionStatus, MovementType } from '@prisma/client'

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

const CreateSaleSchema = z.object({
  cashSessionId: z.string().min(1),
  items: z.array(ItemSchema).min(1),
  paymentMethod: z.nativeEnum(PaymentMethod).default('CASH'),
  amountPaid: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = CreateSaleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { cashSessionId, items, paymentMethod, amountPaid, discountAmount, notes } = parsed.data
  const businessId = session.user.businessId
  const cashierId = session.user.id

  try {
    // Validate cash session is open and belongs to this business
    const cashSession = await db.cashSession.findFirst({
      where: {
        id: cashSessionId,
        status: CashSessionStatus.OPEN,
        branch: { businessId },
      },
    })
    if (!cashSession) {
      return NextResponse.json(
        { error: 'Caja no encontrada o ya cerrada. Abre una caja antes de registrar ventas.' },
        { status: 400 }
      )
    }

    const branchId = cashSession.branchId

    // Load business config: whether this business allows selling without stock
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { allowNegativeStock: true },
    })
    const allowNegativeStock = business?.allowNegativeStock ?? false

    // Load products (multi-tenant guard: must belong to same business and be active)
    const productIds = items.map((i) => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds }, businessId, status: 'ACTIVE' },
    })
    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Uno o más productos no encontrados o inactivos' },
        { status: 400 }
      )
    }
    const productMap = new Map(products.map((p) => [p.id, p]))

    // Load inventory records for all items at this branch
    const inventoryRecords = await db.inventory.findMany({
      where: { productId: { in: productIds }, branchId },
    })
    const inventoryMap = new Map(inventoryRecords.map((inv) => [inv.productId, inv]))

    // Validate stock unless the business allows negative stock
    if (!allowNegativeStock) {
      for (const item of items) {
        const inv = inventoryMap.get(item.productId)
        if (!inv || inv.quantity < item.quantity) {
          const product = productMap.get(item.productId)
          return NextResponse.json(
            {
              error: `Stock insuficiente para "${product?.name ?? item.productId}". Disponible: ${inv?.quantity ?? 0}, Requerido: ${item.quantity}`,
              code: 'INSUFFICIENT_STOCK',
              productId: item.productId,
              available: inv?.quantity ?? 0,
              required: item.quantity,
            },
            { status: 422 }
          )
        }
      }
    }

    // Calculate totals using product tax rates
    let subtotal = 0
    let totalTax = 0
    const itemsWithTotals = items.map((item) => {
      const product = productMap.get(item.productId)!
      const taxRate = Number(product.taxRate)
      const itemSubtotal = round2(item.unitPrice * item.quantity)
      const itemTax = round2(itemSubtotal * taxRate)
      subtotal = round2(subtotal + itemSubtotal)
      totalTax = round2(totalTax + itemTax)
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate,
        taxAmount: itemTax,
        subtotal: itemSubtotal,
        total: round2(itemSubtotal + itemTax),
      }
    })

    const total = round2(subtotal + totalTax - discountAmount)
    if (total < 0) {
      return NextResponse.json({ error: 'El descuento no puede superar el total' }, { status: 400 })
    }

    if (paymentMethod === 'CASH' && amountPaid < total) {
      return NextResponse.json(
        { error: `Monto insuficiente. Total: $${total.toFixed(2)}, Recibido: $${amountPaid.toFixed(2)}` },
        { status: 400 }
      )
    }

    const changeGiven = paymentMethod === 'CASH' ? round2(amountPaid - total) : 0

    // Atomic transaction: create sale + decrement inventory + create movements
    const sale = await db.$transaction(async (tx) => {
      // Generate sequential folio inside transaction to avoid race conditions
      const salesCount = await tx.sale.count({ where: { branchId } })
      const folio = `F-${String(salesCount + 1).padStart(6, '0')}`

      const newSale = await tx.sale.create({
        data: {
          folio,
          status: 'COMPLETED',
          subtotal,
          taxAmount: totalTax,
          discountAmount,
          total,
          paymentMethod,
          amountPaid,
          changeGiven,
          notes,
          branchId,
          cashierId,
          cashSessionId,
        },
      })

      for (const item of itemsWithTotals) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            subtotal: item.subtotal,
            total: item.total,
          },
        })

        // Re-read inventory inside transaction for consistent snapshot
        const currentInv = await tx.inventory.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId } },
        })

        if (!currentInv) {
          throw new Error(`Sin registro de inventario para producto ${item.productId}`)
        }

        const quantityBefore = currentInv.quantity
        const quantityAfter = quantityBefore - item.quantity
        // Mark lowStock when quantity falls to or below the minimum threshold
        const isLowStock = quantityAfter <= currentInv.minStock

        await tx.inventory.update({
          where: { id: currentInv.id },
          data: { quantity: quantityAfter, lowStock: isLowStock },
        })

        await tx.inventoryMovement.create({
          data: {
            type: MovementType.SALE,
            quantity: item.quantity,
            quantityBefore,
            quantityAfter,
            reason: `Venta ${folio}`,
            inventoryId: currentInv.id,
            saleItemId: saleItem.id,
            createdById: cashierId,
          },
        })
      }

      return tx.sale.findUnique({
        where: { id: newSale.id },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          cashier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      })
    })

    // Audit log (best-effort, outside transaction)
    db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entity: 'Sale',
          entityId: sale!.id,
          payload: { folio: sale!.folio, total: String(sale!.total), items: items.length },
          userId: cashierId,
        },
      })
      .catch(() => {})

    // Serialize Decimal fields for JSON response
    const serialized = {
      ...sale,
      subtotal: Number(sale!.subtotal),
      taxAmount: Number(sale!.taxAmount),
      discountAmount: Number(sale!.discountAmount),
      total: Number(sale!.total),
      amountPaid: Number(sale!.amountPaid),
      changeGiven: Number(sale!.changeGiven),
      items: sale!.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        taxRate: Number(i.taxRate),
        taxAmount: Number(i.taxAmount),
        subtotal: Number(i.subtotal),
        total: Number(i.total),
      })),
    }

    return NextResponse.json({ sale: serialized }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sales]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cashSessionId = searchParams.get('cashSessionId')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const businessId = session.user.businessId

  const where: Record<string, unknown> = { branch: { businessId } }
  if (cashSessionId) where.cashSessionId = cashSessionId
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {}
    if (dateFrom) createdAt.gte = new Date(dateFrom)
    if (dateTo) createdAt.lte = new Date(dateTo)
    where.createdAt = createdAt
  }

  const sales = await db.sale.findMany({
    where,
    include: {
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      cashier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const serialized = sales.map((s) => ({
    ...s,
    subtotal: Number(s.subtotal),
    taxAmount: Number(s.taxAmount),
    discountAmount: Number(s.discountAmount),
    total: Number(s.total),
    amountPaid: Number(s.amountPaid),
    changeGiven: Number(s.changeGiven),
    items: s.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      taxAmount: Number(item.taxAmount),
      subtotal: Number(item.subtotal),
      total: Number(item.total),
    })),
  }))

  return NextResponse.json({ sales: serialized })
}
