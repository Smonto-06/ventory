import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: productId } = params
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const businessId = session.user.businessId

  // Verify product belongs to this business
  const product = await db.product.findFirst({
    where: { id: productId, businessId },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      price: true,
      status: true,
      category: { select: { id: true, name: true } },
    },
  })
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  // Get inventory records (all branches, or specific branch)
  const inventoryWhere: Record<string, unknown> = { productId }
  if (branchId) inventoryWhere.branchId = branchId

  const inventory = await db.inventory.findMany({
    where: inventoryWhere,
    include: {
      branch: { select: { id: true, name: true } },
      movements: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          createdBy: { select: { id: true, name: true } },
          saleItem: { select: { saleId: true, sale: { select: { folio: true } } } },
        },
      },
    },
  })

  return NextResponse.json({ product, inventory })
}
