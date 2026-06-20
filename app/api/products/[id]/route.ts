import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  barcode: z.string().max(50).optional(),
  sku: z.string().max(50).optional(),
  price: z.number().positive('El precio debe ser mayor a 0').optional(),
  cost: z.number().nonnegative('El costo no puede ser negativo').optional(),
  taxRate: z.number().min(0).max(1).optional(),
  unitOfMeasure: z.string().max(50).optional(),
  supplier: z.string().max(200).optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

type Params = { params: { id: string } }

async function getProductScoped(id: string, businessId: string) {
  return db.product.findFirst({
    where: { id, businessId },
    include: {
      category: { select: { id: true, name: true } },
      inventory: { select: { quantity: true, minStock: true, branchId: true } },
    },
  })
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const product = await getProductScoped(params.id, session.user.businessId)
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      product: {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
        taxRate: Number(product.taxRate),
        stock: product.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
        minStock: product.inventory.length > 0 ? Math.max(...product.inventory.map((i) => i.minStock)) : 0,
      },
    })
  } catch (error) {
    console.error('GET /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const existing = await db.product.findFirst({
      where: { id: params.id, businessId: session.user.businessId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { price, cost, categoryId, ...rest } = parsed.data

    const effectivePrice = price ?? Number(existing.price)
    const effectiveCost = cost ?? (existing.cost ? Number(existing.cost) : undefined)
    if (effectiveCost !== undefined && effectiveCost > effectivePrice) {
      return NextResponse.json({ error: 'El precio de venta debe ser mayor o igual al costo' }, { status: 400 })
    }

    if (categoryId !== undefined && categoryId !== null) {
      const cat = await db.category.findFirst({
        where: { id: categoryId, businessId: session.user.businessId },
      })
      if (!cat) {
        return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 })
      }
    }

    const product = await db.product.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(price !== undefined && { price }),
        ...(cost !== undefined && { cost }),
        ...(categoryId !== undefined && { categoryId }),
      },
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { quantity: true, minStock: true, branchId: true } },
      },
    })

    return NextResponse.json({
      product: {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
        taxRate: Number(product.taxRate),
        stock: product.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
        minStock: product.inventory.length > 0 ? Math.max(...product.inventory.map((i) => i.minStock)) : 0,
      },
    })
  } catch (error) {
    console.error('PATCH /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden archivar productos' }, { status: 403 })
    }

    const existing = await db.product.findFirst({
      where: { id: params.id, businessId: session.user.businessId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Archive instead of delete to preserve financial records
    await db.product.update({
      where: { id: params.id },
      data: { status: 'ARCHIVED' },
    })

    return NextResponse.json({ message: 'Producto archivado exitosamente' })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
