import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, serialize, isAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  document: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  // Tope informativo de crédito (avisa, no bloquea) — política del negocio,
  // por eso solo encargado/administrador lo pueden fijar.
  creditLimit: z.number().nonnegative().nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  const customer = await db.customer.findFirst({
    where: { id: params.id, businessId: user.businessId },
    include: {
      sales: {
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      payments: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  return NextResponse.json({ customer: serialize(customer) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  try {
    const customer = await db.customer.findFirst({
      where: { id: params.id, businessId: user.businessId },
    })
    if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    // Documento duplicado (regla del prototipo)
    const doc = parsed.data.document?.trim()
    if (doc) {
      const dup = await db.customer.findFirst({
        where: { businessId: user.businessId, document: doc, NOT: { id: params.id } },
      })
      if (dup) return badRequest('Ya existe un cliente con ese documento')
    }

    const { creditLimit, ...rest } = parsed.data
    const setCreditLimit = creditLimit !== undefined && isAdmin(user)

    const updated = await db.customer.update({
      where: { id: params.id },
      data: { ...rest, ...(setCreditLimit ? { creditLimit } : {}) },
    })
    return NextResponse.json({ customer: serialize(updated) })
  } catch (error) {
    return serverError('PUT /api/customers/[id]', error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  // Eliminar un cliente es una acción de gestión, no de mostrador — igual
  // que anular una venta, se reserva a encargado/administrador en vez de
  // estar abierta a cualquier cajero.
  if (!isAdmin(user)) return forbidden('Solo un encargado puede eliminar clientes')

  try {
    const customer = await db.customer.findFirst({
      where: { id: params.id, businessId: user.businessId },
      include: { _count: { select: { sales: true, payments: true } } },
    })
    if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    if (Number(customer.balance) !== 0) {
      // !== 0, no solo > 0: un saldo negativo es plata que el negocio le
      // debe AL cliente (pagó de más) — borrarlo sin más también hacía
      // desaparecer esa deuda del negocio, no solo la del cliente.
      return badRequest('No se puede eliminar: el cliente tiene saldo pendiente')
    }
    if (customer._count.sales > 0 || customer._count.payments > 0) {
      return badRequest('No se puede eliminar: el cliente tiene historial de ventas o abonos')
    }

    await db.customer.delete({ where: { id: params.id } })

    db.auditLog
      .create({
        data: { action: 'DELETE', entity: 'Customer', entityId: params.id, payload: { name: customer.name }, userId: user.id },
      })
      .catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('DELETE /api/customers/[id]', error)
  }
}
