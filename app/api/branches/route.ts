import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const branches = await db.branch.findMany({
    where: { businessId: session.user.businessId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ branches })
}

const CreateBranchSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100),
})

// Crear sucursal (solo administrador)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el administrador crea sucursales' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = CreateBranchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const exists = await db.branch.findFirst({
    where: { businessId: session.user.businessId, name: { equals: parsed.data.name, mode: 'insensitive' } },
  })
  if (exists) return NextResponse.json({ error: 'Ya existe una sucursal con ese nombre' }, { status: 400 })

  const branch = await db.branch.create({
    data: { name: parsed.data.name, businessId: session.user.businessId },
    select: { id: true, name: true },
  })

  db.auditLog
    .create({
      data: { action: 'CREATE', entity: 'Branch', entityId: branch.id, payload: { name: branch.name }, userId: session.user.id },
    })
    .catch(() => {})

  return NextResponse.json({ branch }, { status: 201 })
}
