import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError } from '@/lib/api-helpers'
import { UserRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

// No hay registro público de usuarios: solo el administrador del negocio crea cuentas.
const CreateUserSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del usuario'),
  email: z.string().email('El correo no tiene un formato válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'CASHIER', 'SELLER']).default('CASHIER'),
  branchId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (user.role !== UserRole.ADMIN) return forbidden('Solo el administrador gestiona usuarios')

  const users = await db.user.findMany({
    where: { businessId: user.businessId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      branchId: true,
      branch: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (user.role !== UserRole.ADMIN) return forbidden('Solo el administrador crea usuarios')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const email = parsed.data.email.toLowerCase()

  try {
    const dup = await db.user.findUnique({ where: { email } })
    if (dup) return badRequest('Ya existe un usuario con ese correo')

    if (parsed.data.branchId) {
      const branch = await db.branch.findFirst({
        where: { id: parsed.data.branchId, businessId: user.businessId },
      })
      if (!branch) return badRequest('Sucursal no encontrada')
    }

    const created = await db.user.create({
      data: {
        name: parsed.data.name,
        email,
        password: await bcrypt.hash(parsed.data.password, 12),
        role: parsed.data.role as UserRole,
        branchId: parsed.data.branchId,
        businessId: user.businessId,
        // Los usuarios creados por el administrador (cajeros, supervisores)
        // entran verificados: es el admin quien responde por ellos, no se
        // registran solos ni reciben correo de confirmación.
        emailVerified: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, branchId: true },
    })

    db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entity: 'User',
          entityId: created.id,
          payload: { email, role: parsed.data.role },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ user: created }, { status: 201 })
  } catch (error) {
    return serverError('POST /api/users', error)
  }
}
