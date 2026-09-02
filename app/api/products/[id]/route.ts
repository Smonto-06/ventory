import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { resolveOrCreateSupplier } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullish(),
  // null = limpiar el campo (SKU y código de barras son opcionales)
  barcode: z.string().max(50).nullish(),
  sku: z.string().max(50).nullish(),
  price: z.number().positive('El precio debe ser mayor a 0').optional(),
  cost: z.number().nonnegative('El costo no puede ser negativo').optional(),
  taxRate: z.number().min(0).max(1).optional(),
  unitOfMeasure: z.string().max(50).nullish(),
  supplier: z.string().max(200).nullish(),
  imageUrl: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  minStock: z.number().nonnegative().optional(),
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
        stock: product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0),
        minStock: product.inventory.length > 0 ? Math.max(...product.inventory.map((i) => Number(i.minStock))) : 0,
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

    const { price, cost, categoryId, minStock, ...rest } = parsed.data

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

    // El código de barras no tiene constraint único en BD — sin este chequeo
    // se podían dejar dos productos activos con el mismo barcode (ver mismo
    // comentario en POST /api/products).
    if (rest.barcode?.trim()) {
      const dupBarcode = await db.product.findFirst({
        where: {
          businessId: session.user.businessId,
          barcode: rest.barcode.trim(),
          status: 'ACTIVE',
          NOT: { id: params.id },
        },
        select: { id: true, name: true },
      })
      if (dupBarcode) {
        return NextResponse.json(
          { error: `El código de barras ya está en uso por "${dupBarcode.name}"` },
          { status: 400 },
        )
      }
    }

    // Igual que en la creación: el campo "proveedor" es texto libre y se
    // enlaza con la tabla real Supplier para que la pantalla de Proveedores
    // refleje el cambio.
    const supplierId =
      rest.supplier === undefined
        ? undefined
        : rest.supplier?.trim()
          ? await resolveOrCreateSupplier(db, session.user.businessId, rest.supplier.trim())
          : null

    const product = await db.product.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(price !== undefined && { price }),
        ...(cost !== undefined && { cost }),
        ...(categoryId !== undefined && { categoryId }),
        ...(supplierId !== undefined && { supplierId }),
      },
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { quantity: true, minStock: true, branchId: true } },
      },
    })

    // Precio, costo, nombre o archivado sin rastro alguno era un hueco real
    // en el registro de actividad — la acción más sensible de "editar
    // producto" no dejaba huella.
    db.auditLog
      .create({
        data: {
          action: 'UPDATE',
          entity: 'Product',
          entityId: params.id,
          payload: { fields: Object.keys(parsed.data) },
          userId: session.user.id,
        },
      })
      .catch(() => {})

    // Stock mínimo vive en el inventario por sucursal
    if (minStock !== undefined) {
      await db.inventory.updateMany({
        where: { productId: params.id },
        data: { minStock },
      })
    }

    // El nombre de una variante es "Padre · Etiqueta": si cambia el nombre del
    // padre hay que rehacer el de todas, o quedarían con el nombre viejo en
    // tickets, kardex y reportes.
    if (existing.hasVariants && rest.name && rest.name !== existing.name) {
      const hijas = await db.product.findMany({
        where: { parentId: params.id, businessId: session.user.businessId },
        select: { id: true, variantLabel: true },
      })
      await Promise.all(
        hijas.map((h) =>
          db.product.update({
            where: { id: h.id },
            data: { name: h.variantLabel ? `${rest.name} · ${h.variantLabel}` : rest.name! },
          }),
        ),
      )
    }

    // Archivar o reactivar el padre arrastra a sus variantes: dejarlas sueltas
    // haría que siguieran apareciendo en el punto de venta sin su grupo.
    if (existing.hasVariants && rest.status && rest.status !== existing.status) {
      await db.product.updateMany({
        where: { parentId: params.id, businessId: session.user.businessId },
        data: { status: rest.status },
      })
    }

    return NextResponse.json({
      product: {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
        taxRate: Number(product.taxRate),
        stock: product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0),
        minStock: product.inventory.length > 0 ? Math.max(...product.inventory.map((i) => Number(i.minStock))) : 0,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un producto con ese SKU' }, { status: 400 })
    }
    console.error('PATCH /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden archivar o eliminar productos' }, { status: 403 })
    }

    const existing = await db.product.findFirst({
      where: { id: params.id, businessId: session.user.businessId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const eliminarDeVerdad = new URL(request.url).searchParams.get('eliminar') === '1'

    if (!eliminarDeVerdad) {
      // Se archiva en vez de borrar, para no romper el histórico de ventas.
      // Si es un producto con variantes, se archivan también sus variantes.
      await db.product.update({
        where: { id: params.id },
        data: { status: 'ARCHIVED' },
      })
      if (existing.hasVariants) {
        await db.product.updateMany({
          where: { parentId: params.id, businessId: session.user.businessId },
          data: { status: 'ARCHIVED' },
        })
      }

      db.auditLog
        .create({
          data: {
            action: 'DELETE',
            entity: 'Product',
            entityId: params.id,
            payload: { name: existing.name },
            userId: session.user.id,
          },
        })
        .catch(() => {})

      return NextResponse.json({ message: 'Producto archivado exitosamente' })
    }

    // Eliminación de verdad: solo si el producto (y sus variantes, si es un
    // agrupador) nunca se ha vendido, comprado, cotizado ni movido. Si ya
    // tiene historial, se protege y se pide archivar en su lugar.
    const variantIds = existing.hasVariants
      ? (await db.product.findMany({ where: { parentId: params.id, businessId: session.user.businessId }, select: { id: true } })).map((v) => v.id)
      : []
    const ids = [params.id, ...variantIds]

    const [ventas, compras, cotizaciones, movimientos] = await Promise.all([
      db.saleItem.count({ where: { productId: { in: ids } } }),
      db.purchaseItem.count({ where: { productId: { in: ids } } }),
      db.quoteItem.count({ where: { productId: { in: ids } } }),
      db.inventoryMovement.count({ where: { inventory: { productId: { in: ids } } } }),
    ])
    const actividad = ventas + compras + cotizaciones + movimientos

    if (actividad > 0) {
      return NextResponse.json(
        {
          error: `"${existing.name}" ya tiene historial (${ventas} venta${ventas === 1 ? '' : 's'}, ${compras} compra${compras === 1 ? '' : 's'}, ${movimientos} movimiento${movimientos === 1 ? '' : 's'}) y su nombre vive en facturas y reportes. Archívalo en su lugar.`,
        },
        { status: 409 },
      )
    }

    await db.$transaction([
      db.inventory.deleteMany({ where: { productId: { in: ids } } }),
      db.product.deleteMany({ where: { id: { in: ids } } }),
    ])

    db.auditLog
      .create({
        data: {
          action: 'PRODUCT_DELETE',
          entity: 'Product',
          entityId: params.id,
          payload: { name: existing.name },
          userId: session.user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
