import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(1000).optional(),
  barcode: z.string().max(50).optional(),
  sku: z.string().max(50).optional(),
  price: z.number('El precio es requerido').positive('El precio debe ser mayor a 0'),
  cost: z.number().nonnegative('El costo no puede ser negativo').optional(),
  taxRate: z.number().min(0).max(1).optional(),
  unitOfMeasure: z.string().max(50).optional(),
  supplier: z.string().max(200).optional(),
  categoryId: z.string().optional(),
  // Initial stock (optional, requires branchId)
  branchId: z.string().optional(),
  initialStock: z.number().int().nonnegative('El stock no puede ser negativo').optional(),
  minStock: z.number().int().nonnegative().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const status = searchParams.get('status') ?? 'ACTIVE'
    const categoryId = searchParams.get('categoryId')

    const where: Record<string, unknown> = {
      businessId: session.user.businessId,
      status: status === 'all' ? undefined : status,
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const products = await db.product.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        inventory: {
          select: { quantity: true, minStock: true, branchId: true },
        },
      },
    })

    const result = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      barcode: p.barcode,
      price: Number(p.price),
      cost: p.cost ? Number(p.cost) : null,
      taxRate: Number(p.taxRate),
      unitOfMeasure: p.unitOfMeasure,
      supplier: p.supplier,
      status: p.status,
      category: p.category,
      stock: p.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
      minStock: p.inventory.length > 0 ? Math.max(...p.inventory.map((i) => i.minStock)) : 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))

    return NextResponse.json({ products: result })
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { name, description, barcode, sku, price, cost, taxRate, unitOfMeasure, supplier, categoryId, branchId, initialStock, minStock } = parsed.data

    if (cost !== undefined && cost > price) {
      return NextResponse.json({ error: 'El precio de venta debe ser mayor o igual al costo' }, { status: 400 })
    }

    if (categoryId) {
      const cat = await db.category.findFirst({
        where: { id: categoryId, businessId: session.user.businessId },
      })
      if (!cat) {
        return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 })
      }
    }

    const product = await db.product.create({
      data: {
        name,
        description,
        barcode,
        sku,
        price,
        cost,
        taxRate: taxRate ?? 0.16,
        unitOfMeasure,
        supplier,
        businessId: session.user.businessId,
        categoryId: categoryId ?? null,
        ...(branchId && {
          inventory: {
            create: {
              branchId,
              quantity: initialStock ?? 0,
              minStock: minStock ?? 0,
            },
          },
        }),
      },
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { quantity: true, minStock: true, branchId: true } },
      },
    })

    return NextResponse.json(
      {
        product: {
          ...product,
          price: Number(product.price),
          cost: product.cost ? Number(product.cost) : null,
          taxRate: Number(product.taxRate),
          stock: product.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
