import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, serverError, isFullAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isFullAdmin(user)) return forbidden('Solo el administrador gestiona horarios')

  try {
    const schedule = await db.employeeSchedule.findFirst({
      where: { id: params.id, user: { businessId: user.businessId } },
    })
    if (!schedule) return NextResponse.json({ error: 'Horario no encontrado' }, { status: 404 })

    await db.employeeSchedule.delete({ where: { id: params.id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('DELETE /api/schedules/[id]', error)
  }
}
