import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Los campos de texto opcionales aceptan null (el formulario envía null cuando
// están vacíos): SKU, código de barras, proveedor, categoría y foto son opcionales.
const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(1000).nullish(),
  barcode: z.string().max(50).nullish(),
  sku: z.string().max(50).nullish(),
  price: z.number('El precio es requerido').positive('El precio debe ser mayor a 0'),
  cost: z.number().nonnegative('El costo no puede ser negativo').optional(),
  taxRate: z.number().min(0).max(1).optional(),
  unitOfMeasure: z.string().max(50).nullish(),
  supplier: z.string().max(200).nullish(),
  imageUrl: z.string().nullish(),
  categoryId: z.string().nullish(),
  // Stock inicial (opcional, puede ser 0; requiere branchId)
  branchId: z.string().nullish(),
  initialStock: z.number().nonnegative('El stock no puede ser negativo').optional(),
  minStock: z.number().nonnegative().optional(),
  // ── Variantes ──
  // Si vienen, este producto se crea como "padre" (agrupador, no vendible) y
  // cada combinación se crea como un producto vendible con su propio stock.
  variantOptions: z
    .array(z.object({ nombre: z.string().min(1).max(40), valores: z.array(z.string().min(1).max(40)).min(1) }))
    .max(3)
    .optional(),
  variantes: z
    .array(
      z.object({
        label: z.string().min(1, 'Cada variante necesita un nombre').max(120),
        sku: z.string().max(50).nullish(),
        barcode: z.string().max(50).nullish(),
        price: z.number().positive('El precio de cada variante debe ser mayor a 0').optional(),
        cost: z.number().nonnegative().optional(),
        initialStock: z.number().nonnegative().optional(),
        minStock: z.number().nonnegative().optional(),
      }),
    )
    .max(120)
    .optional(),
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
    // Multi-sucursal: el stock que se muestra debe ser el de la sucursal donde
    // se vende; sin branchId se devuelve el total de todas (vista de negocio).
    const branchId = searchParams.get('branchId')

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

    const result = products.map((p) => {
      const inv = branchId ? p.inventory.filter((i) => i.branchId === branchId) : p.inventory
      return {
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
      imageUrl: p.imageUrl,
      hasVariants: p.hasVariants,
      parentId: p.parentId,
      variantLabel: p.variantLabel,
      variantOptions: p.variantOptions ?? null,
      stock: inv.reduce((sum, i) => sum + Number(i.quantity), 0),
      minStock: inv.length > 0 ? Math.max(...inv.map((i) => Number(i.minStock))) : 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      }
    })

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

    const { name, description, barcode, sku, price, cost, taxRate, unitOfMeasure, supplier, imageUrl, categoryId, branchId, initialStock, minStock, variantOptions, variantes } = parsed.data

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

    // ── Producto con variantes ──
    // El padre no lleva inventario ni se vende; cada variante es un producto
    // completo (stock, SKU, precio propios), así que el resto del sistema
    // —ventas, compras, kardex, reportes— no necesita saber que existen.
    if (variantes && variantes.length > 0) {
      const etiquetas = variantes.map((v) => v.label.trim())
      if (new Set(etiquetas).size !== etiquetas.length) {
        return NextResponse.json({ error: 'Hay variantes repetidas' }, { status: 400 })
      }
      for (const v of variantes) {
        const precio = v.price ?? price
        if (v.cost !== undefined && v.cost > precio) {
          return NextResponse.json(
            { error: `En la variante "${v.label}" el precio debe ser mayor o igual al costo` },
            { status: 400 },
          )
        }
      }

      const padre = await db.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            name,
            description,
            barcode: null,
            sku: null,
            price,
            cost,
            taxRate: taxRate ?? 0.16,
            unitOfMeasure,
            supplier,
            imageUrl,
            businessId: session.user.businessId,
            categoryId: categoryId ?? null,
            hasVariants: true,
            variantOptions: variantOptions ?? undefined,
          },
        })

        for (const v of variantes) {
          const label = v.label.trim()
          await tx.product.create({
            data: {
              name: `${name} · ${label}`,
              description,
              barcode: v.barcode?.trim() || null,
              sku: v.sku?.trim().toUpperCase() || null,
              price: v.price ?? price,
              cost: v.cost ?? cost,
              taxRate: taxRate ?? 0.16,
              unitOfMeasure,
              supplier,
              imageUrl,
              businessId: session.user.businessId,
              categoryId: categoryId ?? null,
              parentId: p.id,
              variantLabel: label,
              ...(branchId && {
                inventory: {
                  create: {
                    branchId,
                    quantity: v.initialStock ?? 0,
                    minStock: v.minStock ?? minStock ?? 0,
                  },
                },
              }),
            },
          })
        }
        return p
      })

      return NextResponse.json(
        {
          product: {
            ...padre,
            price: Number(padre.price),
            cost: padre.cost ? Number(padre.cost) : null,
            taxRate: Number(padre.taxRate),
            stock: 0,
          },
          variantes: variantes.length,
        },
        { status: 201 },
      )
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
        imageUrl,
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
          stock: product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
