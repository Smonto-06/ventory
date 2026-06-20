import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const barcode = searchParams.get('barcode')?.trim()
    const branchId = searchParams.get('branchId')

    if (!q && !barcode) {
      return NextResponse.json({ products: [] })
    }

    const where = barcode
      ? { barcode, businessId: session.user.businessId, status: 'ACTIVE' as const }
      : {
          businessId: session.user.businessId,
          status: 'ACTIVE' as const,
          OR: [
            { name: { contains: q!, mode: 'insensitive' as const } },
            { sku: { contains: q!, mode: 'insensitive' as const } },
            { barcode: { contains: q!, mode: 'insensitive' as const } },
          ],
        }

    const products = await db.product.findMany({
      where,
      take: 20,
      include: {
        category: { select: { name: true } },
        inventory: branchId
          ? { where: { branchId } }
          : true,
      },
      orderBy: { name: 'asc' },
    })

    const serialized = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      price: Number(p.price),
      taxRate: Number(p.taxRate),
      imageUrl: p.imageUrl,
      category: p.category?.name ?? null,
      stock: p.inventory[0]?.quantity ?? null,
    }))

    return NextResponse.json({ products: serialized })
  } catch (error) {
    console.error('Product search error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
