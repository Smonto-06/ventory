import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, badRequest, serverError, serialize } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// Ventas en espera: el carrito se serializa tal cual para reanudarlo después
const CreateHeldSaleSchema = z.object({
  customerName: z.string().trim().optional(),
  itemCount: z.number().int().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  payload: z.record(z.string(), z.unknown()),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  const heldSales = await db.heldSale.findMany({
    where: { businessId: user.businessId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ heldSales: serialize(heldSales) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = CreateHeldSaleSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const heldSale = await db.heldSale.create({
      data: {
        customerName: parsed.data.customerName || null,
        itemCount: parsed.data.itemCount,
        total: Math.round(parsed.data.total),
        payload: parsed.data.payload as object,
        businessId: user.businessId,
        userId: user.id,
      },
    })
    return NextResponse.json({ heldSale: serialize(heldSale) }, { status: 201 })
  } catch (error) {
    return serverError('POST /api/held-sales', error)
  }
}
