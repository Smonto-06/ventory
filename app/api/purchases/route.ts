import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import {
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  isAdmin,
  findOpenCashSession,
  resolveBranchId,
  serialize,
} from '@/lib/api-helpers'
import { CashMovementType, MovementType, PurchaseMethod } from '@prisma/client'
import { requireActiveBusiness } from '@/lib/plan'
import { moveStock } from '@/lib/inventory'

export const dynamic = 'force-dynamic'

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  totalCost: z.number().nonnegative().optional(),
  // Nuevo precio de venta del producto (ganancia % ↔ precio, calculado en el frontend)
  newPrice: z.number().positive().optional(),
})

const CreatePurchaseSchema = z.object({
  // Se acepta id de proveedor existente o nombre libre (se crea si no existe, como en el prototipo)
  supplierId: z.string().optional(),
  supplierName: z.string().trim().optional(),
  branchId: z.string().optional(),
  method: z.enum(['CASH', 'TRANSFER', 'CREDIT']).default('CASH'),
  // Abono inicial — solo aplica cuando method = CREDIT
  initialPayment: z.number().nonnegative().default(0),
  items: z.array(ItemSchema).min(1, 'La compra debe tener al menos un producto'),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  const purchases = await db.purchase.findMany({
    where: { businessId: user.businessId },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } } } },
      payments: { orderBy: { createdAt: 'asc' } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({
    purchases: purchases.map((p) => ({
      ...serialize(p),
      balance: Number(p.total) - Number(p.paidAmount),
    })),
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = CreatePurchaseSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { supplierId, supplierName, method, initialPayment, items, notes } = parsed.data
  if (!supplierId && !supplierName) {
    return badRequest('Indica el proveedor de la compra')
  }

  // Prueba vencida o plan suspendido → no se pueden registrar compras
  const planBlock = await requireActiveBusiness(user.businessId)
  if (planBlock) return planBlock

  try {
    const branchId = await resolveBranchId(user.businessId, parsed.data.branchId)
    if (!branchId) return badRequest('Sucursal no encontrada')

    // Multi-tenant: los productos deben pertenecer al negocio
    const productIds = items.map((i) => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds }, businessId: user.businessId },
    })
    if (products.length !== productIds.length) {
      return badRequest('Uno o más productos no encontrados')
    }

    const total = items.reduce(
      (sum, i) => sum + Math.round(i.totalCost ?? i.quantity * i.unitCost),
      0,
    )
    // Contado y transferencia quedan pagadas completas; crédito arranca con el abono inicial
    const paidAmount =
      method === 'CREDIT' ? Math.min(Math.round(initialPayment), total) : total

    // El pago de contado sale de la caja física: requiere turno abierto
    let cashSessionId: string | null = null
    if (method === 'CASH' && total > 0) {
      const cashSession = await findOpenCashSession(db, branchId)
      if (!cashSession) {
        return badRequest(
          'No hay caja abierta. Abre un turno antes de registrar compras de contado.',
        )
      }
      cashSessionId = cashSession.id
    }

    const purchase = await db.$transaction(async (tx) => {
      // Proveedor: existente o creado al vuelo (como en el prototipo)
      let supplier = supplierId
        ? await tx.supplier.findFirst({ where: { id: supplierId, businessId: user.businessId } })
        : await tx.supplier.findFirst({
            where: {
              businessId: user.businessId,
              name: { equals: supplierName!, mode: 'insensitive' },
            },
          })
      if (!supplier) {
        if (supplierId) throw new Error('SUPPLIER_NOT_FOUND')
        supplier = await tx.supplier.create({
          data: { name: supplierName!, businessId: user.businessId },
        })
      } else if (!supplier.isActive) {
        supplier = await tx.supplier.update({
          where: { id: supplier.id },
          data: { isActive: true },
        })
      }

      const newPurchase = await tx.purchase.create({
        data: {
          method: method as PurchaseMethod,
          total,
          paidAmount,
          notes,
          businessId: user.businessId,
          branchId,
          supplierId: supplier.id,
          createdById: user.id,
        },
      })

      for (const item of items) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: Math.round(item.totalCost ?? item.quantity * item.unitCost),
            newPrice: item.newPrice,
          },
        })

        // Regla del prototipo: stock += qty, costo = unitario nuevo, precio = venta nueva, proveedor
        await tx.product.update({
          where: { id: item.productId },
          data: {
            cost: item.unitCost,
            ...(item.newPrice ? { price: item.newPrice } : {}),
            supplierId: supplier.id,
            supplier: supplier.name,
          },
        })

        // Entrada ATÓMICA: suma sobre el valor real, aunque en ese instante
        // otra caja esté vendiendo el mismo producto
        const move = await moveStock(tx, item.productId, branchId, item.quantity)
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.PURCHASE,
            quantity: item.quantity,
            quantityBefore: move.before,
            quantityAfter: move.after,
            reason: `Compra a ${supplier.name}`,
            inventoryId: move.inventoryId,
            createdById: user.id,
          },
        })
      }

      // Contado → gasto de caja "Pago a proveedor". Transferencia no toca caja física.
      // Crédito: el abono inicial tampoco genera movimiento (regla del prototipo).
      let cashMovementId: string | null = null
      if (method === 'CASH' && total > 0 && cashSessionId) {
        const movement = await tx.cashMovement.create({
          data: {
            type: CashMovementType.EXPENSE,
            amount: total,
            description: 'Pago a proveedor',
            comment: supplier.name,
            cashSessionId,
            createdById: user.id,
          },
        })
        cashMovementId = movement.id
      }

      if (paidAmount > 0) {
        await tx.purchasePayment.create({
          data: {
            purchaseId: newPurchase.id,
            amount: paidAmount,
            method: method === 'TRANSFER' ? 'TRANSFER' : 'CASH',
            cashMovementId,
            createdById: user.id,
          },
        })
      }

      return tx.purchase.findUnique({
        where: { id: newPurchase.id },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } } } },
          payments: true,
        },
      })
    })

    db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entity: 'Purchase',
          entityId: purchase!.id,
          payload: { total: String(purchase!.total), method, items: items.length },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json(
      {
        purchase: {
          ...serialize(purchase),
          balance: Number(purchase!.total) - Number(purchase!.paidAmount),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'SUPPLIER_NOT_FOUND') {
      return badRequest('Proveedor no encontrado')
    }
    return serverError('POST /api/purchases', error)
  }
}
