import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isAdmin, serialize } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const MAX_ESPERAS = 50

// Compras en espera: los ítems en curso se serializan tal cual para
// reanudarlos después. Límite de tamaño en el payload — ver held-sales.
const CreateHeldPurchaseSchema = z.object({
  supplierName: z.string().trim().optional(),
  total: z.number().nonnegative().default(0),
  payload: z.record(z.string(), z.unknown()).refine((p) => JSON.stringify(p).length <= 200_000, {
    message: 'La compra en espera es demasiado grande',
  }),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  const heldPurchases = await db.heldPurchase.findMany({
    where: { businessId: user.businessId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ heldPurchases: serialize(heldPurchases) })
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
  const parsed = CreateHeldPurchaseSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const enEspera = await db.heldPurchase.count({ where: { businessId: user.businessId } })
    if (enEspera >= MAX_ESPERAS) {
      return badRequest(`Hay demasiadas compras en espera (${MAX_ESPERAS}). Retoma o descarta alguna antes de poner otra.`)
    }

    const heldPurchase = await db.heldPurchase.create({
      data: {
        supplierName: parsed.data.supplierName || null,
        total: Math.round(parsed.data.total),
        payload: parsed.data.payload as object,
        businessId: user.businessId,
        userId: user.id,
      },
    })
    return NextResponse.json({ heldPurchase: serialize(heldPurchase) }, { status: 201 })
  } catch (error) {
    return serverError('POST /api/held-purchases', error)
  }
}
