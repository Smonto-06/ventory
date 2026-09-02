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

// Eliminar un empleado. Solo se borra de verdad quien NO tiene historial
// (creado por error, nunca operó): si ya tiene ventas, turnos de caja u otra
// actividad, su nombre vive en facturas y cierres — borrarlo dañaría el
// historial del negocio, así que se responde 409 invitando a desactivarlo.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (user.role !== UserRole.ADMIN) return forbidden('Solo el administrador gestiona usuarios')
  if (params.id === user.id) return badRequest('No puedes eliminar tu propia cuenta.')

  try {
    const objetivo = await db.user.findFirst({
      where: { id: params.id, businessId: user.businessId },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            sales: true,
            voidedSales: true,
            quotes: true,
            cashSessions: true,
            cashSessionsClosed: true,
            cashMovements: true,
            inventoryMovements: true,
            purchases: true,
            purchasePayments: true,
            customerPayments: true,
            saleReturns: true,
            heldSales: true,
            heldPurchases: true,
            auditLogs: true,
          },
        },
      },
    })
    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const c = objetivo._count
    // auditLogs cuenta como actividad también: un AuditLog documenta acciones
    // sobre ENTIDADES DEL NEGOCIO (crear una sucursal, cambiar ajustes, crear
    // otro usuario), no datos personales del usuario — borrarlos en cascada
    // solo porque el usuario que las hizo se elimina le quita al negocio el
    // único rastro de esas acciones. Antes se hacía tx.auditLog.deleteMany()
    // sin más; ahora, si hay auditoría, el borrado de verdad se bloquea igual
    // que con ventas/compras.
    const actividad =
      c.sales + c.voidedSales + c.quotes + c.cashSessions + c.cashSessionsClosed +
      c.cashMovements + c.inventoryMovements + c.purchases + c.purchasePayments +
      c.customerPayments + c.saleReturns + c.heldSales + c.heldPurchases + c.auditLogs

    if (actividad > 0) {
      const partes = [
        c.sales ? `${c.sales} venta${c.sales === 1 ? '' : 's'}` : '',
        c.cashSessions ? `${c.cashSessions} turno${c.cashSessions === 1 ? '' : 's'} de caja` : '',
        c.purchases ? `${c.purchases} compra${c.purchases === 1 ? '' : 's'}` : '',
      ].filter(Boolean)
      return NextResponse.json(
        {
          error:
            `${objetivo.name ?? 'Este usuario'} ya tiene historial` +
            (partes.length ? ` (${partes.join(', ')})` : '') +
            ' y su nombre vive en facturas y cierres. Desactívalo en su lugar: no podrá entrar, pero el historial queda intacto.',
        },
        { status: 409 },
      )
    }

    await db.$transaction(async (tx) => {
      // Solo quedan sus registros de sesión de NextAuth (no son historial del
      // negocio); si tuviera auditLogs, actividad > 0 ya habría cortado arriba.
      await tx.session.deleteMany({ where: { userId: objetivo.id } })
      await tx.account.deleteMany({ where: { userId: objetivo.id } })
      await tx.user.delete({ where: { id: objetivo.id } })
    })

    db.auditLog
      .create({
        data: {
          action: 'DELETE',
          entity: 'User',
          entityId: objetivo.id,
          payload: { email: objetivo.email, name: objetivo.name },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError('DELETE /api/users/[id]', error)
  }
}
