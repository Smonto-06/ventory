import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

// Renombrar o desactivar una sucursal (solo administrador).
// No se puede desactivar la última sucursal activa ni una con caja abierta.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el administrador modifica sucursales' }, { status: 403 })
  }

  const branch = await db.branch.findFirst({
    where: { id: params.id, businessId: session.user.businessId },
  })
  if (!branch) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Mismo chequeo que al crear (POST /api/branches): sin esto se podían
  // terminar con dos sucursales de igual nombre, confundiendo selectores y
  // reportes.
  if (parsed.data.name !== undefined) {
    const exists = await db.branch.findFirst({
      where: {
        businessId: session.user.businessId,
        name: { equals: parsed.data.name, mode: 'insensitive' },
        NOT: { id: params.id },
      },
    })
    if (exists) return NextResponse.json({ error: 'Ya existe una sucursal con ese nombre' }, { status: 400 })
  }

  if (parsed.data.isActive === false) {
    const activeCount = await db.branch.count({
      where: { businessId: session.user.businessId, isActive: true },
    })
    if (activeCount <= 1) {
      return NextResponse.json({ error: 'No puedes desactivar la única sucursal activa' }, { status: 400 })
    }
    const openSession = await db.cashSession.findFirst({
      where: { branchId: params.id, status: 'OPEN' },
    })
    if (openSession) {
      return NextResponse.json({ error: 'Cierra la caja de esta sucursal antes de desactivarla' }, { status: 400 })
    }
  }

  const updated = await db.branch.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, isActive: true },
  })

  db.auditLog
    .create({
      data: { action: 'UPDATE', entity: 'Branch', entityId: params.id, payload: { fields: Object.keys(parsed.data) }, userId: session.user.id },
    })
    .catch(() => {})

  return NextResponse.json({ branch: updated })
}
