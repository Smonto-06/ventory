import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const businessId = session.user.businessId

  const where: Record<string, unknown> = {
    lowStock: true,
    product: { businessId, status: 'ACTIVE' },
  }
  if (branchId) where.branchId = branchId

  const items = await db.inventory.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          price: true,
          category: { select: { id: true, name: true } },
        },
      },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { quantity: 'asc' },
  })

  return NextResponse.json({ items, count: items.length })
}
