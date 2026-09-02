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
import { moveStock, InsufficientStockError } from '@/lib/inventory'
import { requireActiveBusiness } from '@/lib/plan'

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

  // Prueba vencida o plan suspendido → no se puede seguir moviendo inventario
  const planBlock = await requireActiveBusiness(user.businessId)
  if (planBlock) return planBlock

  try {
    const branchId = await resolveBranchId(user.businessId, parsed.data.branchId)
    if (!branchId) return badRequest('Sucursal no encontrada')

    // status: ACTIVE — no alcanzable desde el modal de traslado (ya filtra
    // productos archivados), pero la API en sí no lo bloqueaba.
    const product = await db.product.findFirst({
      where: { id: productId, businessId: user.businessId, status: 'ACTIVE' },
      select: { id: true, name: true },
    })
    if (!product) return badRequest('Producto no encontrado o archivado')

    const result = await db.$transaction(async (tx) => {
      // Movimiento atómico; una salida nunca puede dejar el stock en negativo
      const move = await moveStock(tx, productId, branchId, direction === 'out' ? -quantity : quantity)
      if (direction === 'out' && move.after < 0) {
        throw new InsufficientStockError(product.name, move.before, quantity)
      }
      await tx.inventoryMovement.create({
        data: {
          type: MovementType.ADJUSTMENT,
          quantity,
          quantityBefore: move.before,
          quantityAfter: move.after,
          reason: `Traslado ${direction === 'out' ? 'salida' : 'entrada'}${notes ? ` · ${notes}` : ''}`,
          inventoryId: move.inventoryId,
          createdById: user.id,
        },
      })
      return { before: move.before, after: move.after }
    })

    return NextResponse.json({ product: product.name, ...result })
  } catch (error) {
    return serverError('POST /api/inventory/transfer', error)
  }
}
