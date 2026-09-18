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
import { MovementType, Prisma } from '@prisma/client'
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
  // Generado por el cliente al intentar el traslado (no en cada reintento):
  // ver comentario en Sale.clientOpId — misma protección para la cola
  // offline (un 5xx ambiguo puede llegar DESPUÉS de que el traslado ya
  // comitió; sin esto, reenviarlo movía el stock una segunda vez).
  clientOpId: z.string().max(100).optional(),
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

  const { productId, quantity, direction, notes, clientOpId } = parsed.data

  // Un 5xx ambiguo puede llegar DESPUÉS de que el traslado ya comitió
  // (timeout, despliegue a mitad de respuesta) — la cola offline lo
  // reintenta creyendo que nunca se registró. Si ya existe un movimiento con
  // este clientOpId, se devuelve tal cual (sin mover stock otra vez) en vez
  // de aplicarlo una segunda vez. Debe ir ANTES de cualquier validación que
  // lea estado que el traslado original ya modificó (mismo motivo que en
  // POST /api/sales).
  if (clientOpId) {
    const existing = await db.inventoryMovement.findFirst({
      where: { clientOpId, inventory: { product: { businessId: user.businessId } } },
      select: { quantityBefore: true, quantityAfter: true, inventory: { select: { product: { select: { name: true } } } } },
    })
    if (existing) {
      return NextResponse.json({
        product: existing.inventory.product.name,
        before: existing.quantityBefore,
        after: existing.quantityAfter,
      })
    }
  }

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
          clientOpId: clientOpId ?? undefined,
        },
      })
      return { before: move.before, after: move.after }
    })

    return NextResponse.json({ product: product.name, ...result })
  } catch (error) {
    // Rechazo de negocio (stock insuficiente para la salida), no un error
    // real del servidor — mismo trato que ya recibe en POST /api/sales.
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: error.message, code: 'INSUFFICIENT_STOCK', available: error.available, required: error.required },
        { status: 422 },
      )
    }
    // Dos solicitudes casi simultáneas con el mismo clientOpId (reintento en
    // vuelo + el original llegando tarde): la que pierde la carrera del
    // constraint único no debe duplicar el movimiento de stock, sino
    // devolver el que sí quedó registrado (mismo patrón que purchases/route.ts).
    if (
      clientOpId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      (error.meta?.target as string[] | undefined)?.includes('clientOpId')
    ) {
      const existing = await db.inventoryMovement.findFirst({
        where: { clientOpId, inventory: { product: { businessId: user.businessId } } },
        select: { quantityBefore: true, quantityAfter: true, inventory: { select: { product: { select: { name: true } } } } },
      })
      if (existing) {
        return NextResponse.json({
          product: existing.inventory.product.name,
          before: existing.quantityBefore,
          after: existing.quantityAfter,
        })
      }
    }
    return serverError('POST /api/inventory/transfer', error)
  }
}
