import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isFullAdmin, serialize } from '@/lib/api-helpers'
import { ventanaHorario } from '@/lib/schedules'

export const dynamic = 'force-dynamic'

// Horarios de trabajo (Ajustes → Usuarios → Horarios): solo el administrador
// los asigna, igual que crea/edita usuarios.

const CreateScheduleSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de entrada inválida'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de salida inválida'),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isFullAdmin(user)) return forbidden('Solo el administrador gestiona horarios')

  const targetUserId = new URL(req.url).searchParams.get('userId') ?? undefined

  const schedules = await db.employeeSchedule.findMany({
    where: {
      user: { businessId: user.businessId },
      ...(targetUserId ? { userId: targetUserId } : {}),
    },
    select: { id: true, userId: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ schedules: serialize(schedules) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isFullAdmin(user)) return forbidden('Solo el administrador asigna horarios')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = CreateScheduleSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const target = await db.user.findFirst({
      where: { id: parsed.data.userId, businessId: user.businessId },
      select: { id: true },
    })
    if (!target) return badRequest('Usuario no encontrado')

    const { startsAt, endsAt } = ventanaHorario(parsed.data.date, parsed.data.startTime, parsed.data.endTime)

    const created = await db.employeeSchedule.create({
      data: { userId: target.id, startsAt, endsAt },
      select: { id: true, userId: true, startsAt: true, endsAt: true },
    })

    db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entity: 'EmployeeSchedule',
          entityId: created.id,
          payload: { userId: target.id, startsAt: created.startsAt, endsAt: created.endsAt },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ schedule: serialize(created) }, { status: 201 })
  } catch (error) {
    return serverError('POST /api/schedules', error)
  }
}
