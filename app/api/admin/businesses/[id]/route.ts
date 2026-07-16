import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError } from '@/lib/api-helpers'
import { planInfo, isSuperAdmin, TRIAL_DAYS } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const ActionSchema = z.object({
  // activate: plan activo · suspend: bloquear · extend: +N días de prueba
  action: z.enum(['activate', 'suspend', 'extend']),
  days: z.number().int().min(1).max(365).default(TRIAL_DAYS),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user.email)) return forbidden('Solo el administrador de la plataforma')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const business = await db.business.findUnique({ where: { id: params.id } })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const { action, days, notes } = parsed.data
    const data: Record<string, unknown> = {}
    if (notes !== undefined) data.adminNotes = notes

    if (action === 'activate') {
      data.status = 'ACTIVE'
      data.activatedAt = new Date()
      data.trialEndsAt = null
    } else if (action === 'suspend') {
      data.status = 'SUSPENDED'
    } else {
      // extend: reanuda/alarga la prueba desde hoy o desde el vencimiento futuro
      const base =
        business.trialEndsAt && business.trialEndsAt > new Date()
          ? business.trialEndsAt.getTime()
          : Date.now()
      data.status = 'TRIAL'
      data.trialEndsAt = new Date(base + days * 86400000)
    }

    const updated = await db.business.update({ where: { id: params.id }, data })

    db.auditLog
      .create({
        data: {
          action: `PLAN_${action.toUpperCase()}`,
          entity: 'Business',
          entityId: params.id,
          payload: { days: action === 'extend' ? days : undefined, notes: notes ?? null },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({
      business: { id: updated.id, name: updated.name, plan: planInfo(updated), adminNotes: updated.adminNotes },
    })
  } catch (error) {
    return serverError('POST /api/admin/businesses/[id]', error)
  }
}
