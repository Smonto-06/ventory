import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const SupplierSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del proveedor'),
  phone: z.string().trim().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  const suppliers = await db.supplier.findMany({
    where: { businessId: user.businessId, isActive: true },
    include: {
      products: {
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, sku: true, price: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      productCount: s.products.length,
      products: s.products.map((p) => ({ ...p, price: Number(p.price) })),
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
  const parsed = SupplierSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const dup = await db.supplier.findFirst({
      where: {
        businessId: user.businessId,
        name: { equals: parsed.data.name, mode: 'insensitive' },
        isActive: true,
      },
    })
    if (dup) return badRequest('Ya existe un proveedor con ese nombre')

    const supplier = await db.supplier.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        businessId: user.businessId,
      },
    })
    return NextResponse.json({ supplier }, { status: 201 })
  } catch (error) {
    return serverError('POST /api/suppliers', error)
  }
}
