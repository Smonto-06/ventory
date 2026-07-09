import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError } from '@/lib/api-helpers'
import { UserRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

const UpdateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email('El correo no tiene un formato válido').optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'CASHIER', 'SELLER']).optional(),
  branchId: z.string().nullable().optional(),
  // Activar/desactivar usuario (el prototipo alterna Activo/Inactivo)
  isActive: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (user.role !== UserRole.ADMIN) return forbidden('Solo el administrador gestiona usuarios')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const target = await db.user.findFirst({
      where: { id: params.id, businessId: user.businessId },
    })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    // Un admin no puede desactivarse ni quitarse el rol a sí mismo (evita dejar el negocio sin admin)
    if (params.id === user.id && (parsed.data.isActive === false || (parsed.data.role && parsed.data.role !== 'ADMIN'))) {
      return badRequest('No puedes desactivar ni cambiar el rol de tu propia cuenta')
    }

    const email = parsed.data.email?.toLowerCase()
    if (email && email !== target.email) {
      const dup = await db.user.findUnique({ where: { email } })
      if (dup) return badRequest('Ya existe un usuario con ese correo')
    }

    if (parsed.data.branchId) {
      const branch = await db.branch.findFirst({
        where: { id: parsed.data.branchId, businessId: user.businessId },
      })
      if (!branch) return badRequest('Sucursal no encontrada')
    }

    const updated = await db.user.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(email ? { email } : {}),
        ...(parsed.data.password ? { password: await bcrypt.hash(parsed.data.password, 12) } : {}),
        ...(parsed.data.role ? { role: parsed.data.role as UserRole } : {}),
        ...(parsed.data.branchId !== undefined ? { branchId: parsed.data.branchId } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, branchId: true },
    })

    db.auditLog
      .create({
        data: {
          action: 'UPDATE',
          entity: 'User',
          entityId: params.id,
          payload: { fields: Object.keys(parsed.data) },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ user: updated })
  } catch (error) {
    return serverError('PUT /api/users/[id]', error)
  }
}
