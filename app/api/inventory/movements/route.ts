import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { MovementType } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const productId = searchParams.get('productId')
  const type = searchParams.get('type')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const take = Math.min(Number(searchParams.get('take') ?? '50'), 200)
  const businessId = session.user.businessId

  // Validate type filter if provided
  if (type && !Object.values(MovementType).includes(type as MovementType)) {
    return NextResponse.json(
      { error: `Tipo de movimiento inválido. Valores permitidos: ${Object.values(MovementType).join(', ')}` },
      { status: 400 }
    )
  }

  const where: Record<string, unknown> = {
    inventory: {
      product: { businessId },
      ...(branchId ? { branchId } : {}),
      ...(productId ? { productId } : {}),
    },
  }
  if (type) where.type = type as MovementType
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {}
    if (dateFrom) createdAt.gte = new Date(dateFrom)
    if (dateTo) createdAt.lte = new Date(dateTo)
    where.createdAt = createdAt
  }

  const movements = await db.inventoryMovement.findMany({
    where,
    include: {
      inventory: {
        select: {
          id: true,
          quantity: true,
          product: { select: { id: true, name: true, sku: true } },
          branch: { select: { id: true, name: true } },
        },
      },
      saleItem: {
        select: {
          id: true,
          saleId: true,
          sale: { select: { folio: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  })

  return NextResponse.json({ movements, count: movements.length })
}
