import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'

const openSchema = z.object({
  branchId: z.string().min(1, 'Sucursal requerida'),
  terminal: z.string().optional(),
  openingBalance: z.number().min(0, 'El monto inicial no puede ser negativo'),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const parsed = openSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { branchId, terminal, openingBalance, notes } = parsed.data

  const branch = await db.branch.findFirst({
    where: { id: branchId, businessId: user.businessId, isActive: true },
  })
  if (!branch) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  const existing = await db.cashSession.findFirst({
    where: { openedById: user.id, status: 'OPEN' },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'Ya tienes una caja abierta en este turno', sessionId: existing.id },
      { status: 409 },
    )
  }

  const session = await db.cashSession.create({
    data: {
      branchId,
      openedById: user.id,
      terminal,
      openingBalance,
      notes,
      status: 'OPEN',
    },
    include: {
      branch: { select: { id: true, name: true } },
      openedBy: { select: { id: true, name: true, role: true } },
    },
  })

  return NextResponse.json({ session }, { status: 201 })
}
