import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, serialize } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// Registro de actividad del negocio (auditoría) — solo administrador.
// Últimos 200 eventos de los usuarios del negocio.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (user.role !== 'ADMIN') return forbidden('Solo el administrador consulta la auditoría')

  const logs = await db.auditLog.findMany({
    where: { user: { businessId: user.businessId } },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      payload: serialize(l.payload),
      user: l.user.name ?? l.user.email,
      createdAt: l.createdAt,
    })),
  })
}
