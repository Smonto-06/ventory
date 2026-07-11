import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, serverError, isAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()

  try {
    const held = await db.heldPurchase.findFirst({
      where: { id: params.id, businessId: user.businessId },
    })
    if (!held) return NextResponse.json({ error: 'Espera no encontrada' }, { status: 404 })

    await db.heldPurchase.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('DELETE /api/held-purchases/[id]', error)
  }
}
