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

const TransferSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  // 'out' = salida de mercancía hacia otra sucursal; 'in' = entrada
  direction: z.enum(['in', 'out']),
  branchId: z.string().optional(),
  notes: z.string().optional(),
})

// Traslado de inventario entre sucursales (el prototipo maneja una sola sucursal de datos:
// la contraparte se registra como referencia en el movimiento)
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
  const parsed = TransferSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { productId, quantity, direction, notes } = parsed.data

  try {
    const branchId = await resolveBranchId(user.businessId, parsed.data.branchId)
    if (!branchId) return badRequest('Sucursal no encontrada')

    const product = await db.product.findFirst({
      where: { id: productId, businessId: user.businessId },
      select: { id: true, name: true },
    })
    if (!product) return badRequest('Producto no encontrado')

    const result = await db.$transaction(async (tx) => {
      const inv = await tx.inventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { productId, branchId, quantity: 0 },
        update: {},
      })
      // Como el prototipo: la salida no baja de 0
      const quantityAfter =
        direction === 'out' ? Math.max(0, Number(inv.quantity) - quantity) : Number(inv.quantity) + quantity

      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: quantityAfter, lowStock: quantityAfter <= Number(inv.minStock) },
      })
      await tx.inventoryMovement.create({
        data: {
          type: MovementType.ADJUSTMENT,
          quantity: Math.abs(quantityAfter - Number(inv.quantity)),
          quantityBefore: Number(inv.quantity),
          quantityAfter,
          reason: `Traslado ${direction === 'out' ? 'salida' : 'entrada'}${notes ? ` · ${notes}` : ''}`,
          inventoryId: inv.id,
          createdById: user.id,
        },
      })
      return { before: Number(inv.quantity), after: quantityAfter }
    })

    return NextResponse.json({ product: product.name, ...result })
  } catch (error) {
    return serverError('POST /api/inventory/transfer', error)
  }
}
