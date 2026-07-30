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
  resolveBranchId,
} from '@/lib/api-helpers'
import { MovementType } from '@prisma/client'

export const dynamic = 'force-dynamic'

const AdjustSchema = z.object({
  branchId: z.string().optional(),
  adjustments: z
    .array(
      z.object({
        productId: z.string().min(1),
        // Stock absoluto resultante (el modal de ajuste del prototipo escribe el conteo físico)
        quantity: z.number().min(0),
      }),
    )
    .min(1, 'Indica al menos un producto a ajustar'),
  reason: z.string().optional(),
})

// Ajuste de inventario: fija el stock físico contado por producto (transaccional, con auditoría)
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
  const parsed = AdjustSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const branchId = await resolveBranchId(user.businessId, parsed.data.branchId)
    if (!branchId) return badRequest('Sucursal no encontrada')

    const productIds = parsed.data.adjustments.map((a) => a.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds }, businessId: user.businessId },
      select: { id: true, name: true },
    })
    if (products.length !== productIds.length) {
      return badRequest('Uno o más productos no encontrados')
    }

    const results = await db.$transaction(async (tx) => {
      const changed: Array<{ productId: string; before: number; after: number }> = []
      for (const adj of parsed.data.adjustments) {
        const inv = await tx.inventory.upsert({
          where: { productId_branchId: { productId: adj.productId, branchId } },
          create: { productId: adj.productId, branchId, quantity: 0 },
          update: {},
        })
        if (Number(inv.quantity) === adj.quantity) continue

        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: adj.quantity, lowStock: adj.quantity <= Number(inv.minStock) },
        })
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.ADJUSTMENT,
            quantity: Math.abs(adj.quantity - Number(inv.quantity)),
            quantityBefore: Number(inv.quantity),
            quantityAfter: adj.quantity,
            reason: parsed.data.reason ?? 'Ajuste de inventario',
            inventoryId: inv.id,
            createdById: user.id,
          },
        })
        changed.push({ productId: adj.productId, before: Number(inv.quantity), after: adj.quantity })
      }
      return changed
    })

    db.auditLog
      .create({
        data: {
          action: 'ADJUST',
          entity: 'Inventory',
          entityId: branchId,
          payload: { adjustments: results },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ adjusted: results.length, changes: results })
  } catch (error) {
    return serverError('POST /api/inventory/adjust', error)
  }
}
