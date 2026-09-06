import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100),
  description: z.string().max(500).optional(),
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
    const category = await db.category.findFirst({
      where: { id: params.id, businessId: user.businessId },
    })
    if (!category) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

    const dup = await db.category.findFirst({
      where: {
        businessId: user.businessId,
        name: { equals: parsed.data.name, mode: 'insensitive' },
        NOT: { id: params.id },
      },
    })
    if (dup) return badRequest('Ya existe una categoría con ese nombre')

    const updated = await db.category.update({ where: { id: params.id }, data: parsed.data })
    return NextResponse.json({ category: updated })
  } catch (error) {
    return serverError('PUT /api/categories/[id]', error)
  }
}

// Regla del prototipo: una categoría solo es eliminable si no tiene productos asociados
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  try {
    const category = await db.category.findFirst({
      where: { id: params.id, businessId: user.businessId },
      include: { _count: { select: { products: { where: { status: { not: 'ARCHIVED' } } } } } },
    })
    if (!category) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

    if (category._count.products > 0) {
      return badRequest(
        `No se puede eliminar: la categoría tiene ${category._count.products} producto(s) asociado(s)`,
      )
    }

    await db.category.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('DELETE /api/categories/[id]', error)
  }
}
