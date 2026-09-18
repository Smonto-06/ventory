import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/api-helpers'
import type { SessionUser } from '@/lib/get-session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const businessId = session.user.businessId
  const q = new URL(req.url).searchParams.get('q') ?? ''

  const customers = await db.customer.findMany({
    where: {
      businessId,
      ...(q.trim()
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { document: { contains: q } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, phone: true, email: true, document: true, address: true, balance: true, creditLimit: true },
    take: q.trim() ? 10 : 100,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ customers })
}

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().optional(),
  email: z.string().optional(),
  document: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  // Tope informativo de crédito (avisa, no bloquea) — política del negocio,
  // por eso solo encargado/administrador lo pueden fijar.
  creditLimit: z.number().nonnegative().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const businessId = session.user.businessId

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = CreateCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, phone, email, document, address, notes, creditLimit } = parsed.data

  // Documento duplicado (misma regla que ya aplica PUT /api/customers/[id])
  const doc = document?.trim()
  if (doc) {
    const dup = await db.customer.findFirst({ where: { businessId, document: doc } })
    if (dup) return NextResponse.json({ error: 'Ya existe un cliente con ese documento' }, { status: 400 })
  }

  const setCreditLimit = creditLimit !== undefined && isAdmin(session.user as unknown as SessionUser)

  const customer = await db.customer.create({
    data: {
      name,
      phone: phone || null,
      email: email || null,
      document: document || null,
      address: address || null,
      notes: notes || null,
      businessId,
      ...(setCreditLimit ? { creditLimit } : {}),
    },
    select: { id: true, name: true, phone: true, email: true, document: true, address: true, balance: true, creditLimit: true },
  })

  return NextResponse.json({ customer }, { status: 201 })
}
