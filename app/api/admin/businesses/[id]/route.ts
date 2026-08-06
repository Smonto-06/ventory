import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError } from '@/lib/api-helpers'
import { planInfo, isSuperAdmin, TRIAL_DAYS } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const ActionSchema = z.object({
  // activate: plan activo · suspend: bloquear · extend: +N días de prueba
  action: z.enum(['activate', 'suspend', 'extend']),
  days: z.number().int().min(1).max(365).default(TRIAL_DAYS),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user.email)) return forbidden('Solo el administrador de la plataforma')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const business = await db.business.findUnique({ where: { id: params.id } })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const { action, days, notes } = parsed.data
    const data: Record<string, unknown> = {}
    if (notes !== undefined) data.adminNotes = notes

    if (action === 'activate') {
      // Activación manual: sin vencimiento (paidUntil solo lo pone Wompi)
      data.status = 'ACTIVE'
      data.activatedAt = new Date()
      data.trialEndsAt = null
      data.paidUntil = null
    } else if (action === 'suspend') {
      data.status = 'SUSPENDED'
    } else {
      // extend: reanuda/alarga la prueba desde hoy o desde el vencimiento futuro
      const base =
        business.trialEndsAt && business.trialEndsAt > new Date()
          ? business.trialEndsAt.getTime()
          : Date.now()
      data.status = 'TRIAL'
      data.trialEndsAt = new Date(base + days * 86400000)
    }

    const updated = await db.business.update({ where: { id: params.id }, data })

    db.auditLog
      .create({
        data: {
          action: `PLAN_${action.toUpperCase()}`,
          entity: 'Business',
          entityId: params.id,
          payload: { days: action === 'extend' ? days : undefined, notes: notes ?? null },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({
      business: { id: updated.id, name: updated.name, plan: planInfo(updated), adminNotes: updated.adminNotes },
    })
  } catch (error) {
    return serverError('POST /api/admin/businesses/[id]', error)
  }
}

const DeleteSchema = z.object({
  // El nombre exacto del negocio, como confirmación de borrado irreversible
  confirm: z.string().min(1, 'Escribe el nombre del negocio para confirmar'),
})

// Eliminación DEFINITIVA de un negocio y todos sus datos (usuarios, ventas,
// inventario, caja, clientes, proveedores, compras). Irreversible.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user.email)) return forbidden('Solo el administrador de la plataforma')

  if (params.id === user.businessId) {
    return badRequest('No puedes eliminar tu propio negocio desde el panel.')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const business = await db.business.findUnique({ where: { id: params.id } })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    if (parsed.data.confirm.trim() !== business.name.trim()) {
      return badRequest('El nombre no coincide. Escribe el nombre exacto del negocio para confirmar.')
    }

    const businessId = params.id
    await db.$transaction(
      async (tx) => {
        const users = await tx.user.findMany({ where: { businessId }, select: { id: true } })
        const userIds = users.map((u) => u.id)

        // Hijos primero, en orden de dependencias (las FK no tienen cascade)
        await tx.auditLog.deleteMany({ where: { userId: { in: userIds } } })
        await tx.inventoryMovement.deleteMany({ where: { inventory: { branch: { businessId } } } })
        await tx.quoteItem.deleteMany({ where: { quote: { businessId } } })
        await tx.quote.deleteMany({ where: { businessId } })
        await tx.saleReturnItem.deleteMany({ where: { return: { sale: { branch: { businessId } } } } })
        await tx.saleReturn.deleteMany({ where: { sale: { branch: { businessId } } } })
        await tx.salePayment.deleteMany({ where: { sale: { branch: { businessId } } } })
        await tx.saleItem.deleteMany({ where: { sale: { branch: { businessId } } } })
        await tx.sale.deleteMany({ where: { branch: { businessId } } })
        await tx.customerPayment.deleteMany({ where: { customer: { businessId } } })
        await tx.purchasePayment.deleteMany({ where: { purchase: { businessId } } })
        await tx.purchaseItem.deleteMany({ where: { purchase: { businessId } } })
        await tx.purchase.deleteMany({ where: { businessId } })
        await tx.heldSale.deleteMany({ where: { businessId } })
        await tx.heldPurchase.deleteMany({ where: { businessId } })
        await tx.cashMovement.deleteMany({ where: { cashSession: { branch: { businessId } } } })
        await tx.cashSession.deleteMany({ where: { branch: { businessId } } })
        await tx.inventory.deleteMany({ where: { branch: { businessId } } })
        await tx.product.deleteMany({ where: { businessId } })
        await tx.category.deleteMany({ where: { businessId } })
        await tx.customer.deleteMany({ where: { businessId } })
        await tx.supplier.deleteMany({ where: { businessId } })
        await tx.branch.deleteMany({ where: { businessId } })
        await tx.session.deleteMany({ where: { userId: { in: userIds } } })
        await tx.account.deleteMany({ where: { userId: { in: userIds } } })
        await tx.user.deleteMany({ where: { businessId } })
        await tx.business.delete({ where: { id: businessId } })
      },
      { timeout: 60000 },
    )

    db.auditLog
      .create({
        data: {
          action: 'PLATFORM_DELETE_BUSINESS',
          entity: 'Business',
          entityId: businessId,
          payload: { name: business.name },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ deleted: true, name: business.name })
  } catch (error) {
    return serverError('DELETE /api/admin/businesses/[id]', error)
  }
}
