import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden } from '@/lib/api-helpers'
import { isSuperAdmin } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const ACCIONES_PLATAFORMA = ['PLAN_ACTIVATE', 'PLAN_SUSPEND', 'PLAN_EXTEND', 'PLATFORM_NOTES', 'PLATFORM_DELETE_BUSINESS']

// Rastro de lo que el super-admin hizo sobre cada negocio (activar, suspender,
// extender prueba, guardar nota, eliminar), para saber quién hizo qué y cuándo.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user.email)) return forbidden('Solo el administrador de la plataforma')

  const entries = await db.auditLog.findMany({
    where: { entity: 'Business', action: { in: ACCIONES_PLATAFORMA } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: { user: { select: { name: true, email: true } } },
  })

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      businessId: e.entityId,
      payload: e.payload,
      at: e.createdAt,
      by: e.user?.name ?? e.user?.email ?? 'Desconocido',
    })),
  })
}
