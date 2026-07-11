import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, serverError } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// Descartar o reanudar (el frontend hace GET all + DELETE al reanudar) una venta en espera
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  try {
    const held = await db.heldSale.findFirst({
      where: { id: params.id, businessId: user.businessId },
    })
    if (!held) return NextResponse.json({ error: 'Espera no encontrada' }, { status: 404 })

    await db.heldSale.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('DELETE /api/held-sales/[id]', error)
  }
}
