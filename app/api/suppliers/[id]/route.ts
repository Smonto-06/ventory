import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const supplier = await db.supplier.findFirst({
      where: { id: params.id, businessId: user.businessId },
    })
    if (!supplier) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    if (parsed.data.name) {
      const dup = await db.supplier.findFirst({
        where: {
          businessId: user.businessId,
          name: { equals: parsed.data.name, mode: 'insensitive' },
          isActive: true,
          NOT: { id: params.id },
        },
      })
      if (dup) return badRequest('Ya existe un proveedor con ese nombre')
    }

    const updated = await db.supplier.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
      },
    })
    return NextResponse.json({ supplier: updated })
  } catch (error) {
    return serverError('PUT /api/suppliers/[id]', error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  try {
    const supplier = await db.supplier.findFirst({
      where: { id: params.id, businessId: user.businessId },
      include: { purchases: { where: {}, select: { id: true, total: true, paidAmount: true } } },
    })
    if (!supplier) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    const pending = supplier.purchases.some((p) => Number(p.total) - Number(p.paidAmount) > 0)
    if (pending) {
      return badRequest('No se puede eliminar: el proveedor tiene compras con saldo pendiente')
    }

    // Soft delete: se conserva el historial de compras
    await db.supplier.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('DELETE /api/suppliers/[id]', error)
  }
}
