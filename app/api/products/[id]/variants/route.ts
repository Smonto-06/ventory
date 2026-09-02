import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/** Otra petición concurrente (doble clic) ya creó una variante con ese nombre */
class VariantAlreadyExistsError extends Error {
  constructor(label: string) {
    super(`La variante "${label}" ya existe`)
    this.name = 'VariantAlreadyExistsError'
  }
}

// Agrega variantes a un producto que ya existe.
//
// Sirve para dos casos: sumar una talla nueva a un producto que ya tiene
// variantes, y convertir en "producto con variantes" a uno que se creó suelto
// (por ejemplo, la tienda empezó con "Camiseta Básica" y después necesitó
// tallas). En el segundo caso el stock que ya tenía el producto se traslada a
// la primera variante, para no perder ni inventar mercancía.

const schema = z.object({
  branchId: z.string().nullish(),
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
        price: z.number().positive().optional(),
        cost: z.number().nonnegative().optional(),
        initialStock: z.number().nonnegative().optional(),
        minStock: z.number().nonnegative().optional(),
      }),
    )
    .min(1, 'Agrega al menos una variante')
    .max(120),
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const padre = await db.product.findFirst({
      where: { id: params.id, businessId: session.user.businessId },
    })
    if (!padre) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    if (padre.parentId) {
      return NextResponse.json(
        { error: 'Esta ya es una variante: agrega las nuevas desde el producto principal' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { variantes, variantOptions, branchId } = parsed.data

    // El id de sucursal es un cuid global (no compuesto con businessId): sin
    // este chequeo se podía crear inventario en una sucursal de OTRO negocio.
    if (branchId) {
      const suc = await db.branch.findFirst({
        where: { id: branchId, businessId: session.user.businessId, isActive: true },
      })
      if (!suc) {
        return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 400 })
      }
    }

    const existentes = await db.product.findMany({
      where: { parentId: padre.id, businessId: session.user.businessId },
      select: { variantLabel: true },
    })
    const yaHay = new Set(existentes.map((v) => (v.variantLabel ?? '').toLowerCase()))
    const nuevas = variantes.map((v) => ({ ...v, label: v.label.trim() }))

    for (const v of nuevas) {
      if (yaHay.has(v.label.toLowerCase())) {
        return NextResponse.json({ error: `La variante "${v.label}" ya existe` }, { status: 400 })
      }
      const precio = v.price ?? Number(padre.price)
      if (v.cost !== undefined && v.cost > precio) {
        return NextResponse.json(
          { error: `En la variante "${v.label}" el precio debe ser mayor o igual al costo` },
          { status: 400 },
        )
      }
    }
    if (new Set(nuevas.map((v) => v.label.toLowerCase())).size !== nuevas.length) {
      return NextResponse.json({ error: 'Hay variantes repetidas' }, { status: 400 })
    }

    // Un producto suelto que pasa a tener variantes: su inventario actual se
    // mueve a la primera variante y el padre queda solo como agrupador.
    const convirtiendo = !padre.hasVariants

    const creadas = await db.$transaction(async (tx) => {
      // El stock heredado se lee y se bloquea DENTRO de la transacción (no
      // antes de abrirla): si una venta concurrente del producto suelto
      // alcanza a descontar stock mientras se arma este formulario, la
      // primera variante hereda el valor real y actual, no uno viejo —
      // mismo idioma que setStock() en lib/inventory.ts.
      const stockHeredado = convirtiendo
        ? (
            await tx.$queryRaw<Array<{ branchId: string; quantity: string; minStock: string }>>`
              SELECT "branchId", "quantity", "minStock" FROM "inventory"
              WHERE "productId" = ${padre.id}
              FOR UPDATE
            `
          ).map((i) => ({
            branchId: i.branchId,
            quantity: Number(i.quantity),
            minStock: Number(i.minStock),
          }))
        : []

      if (convirtiendo) {
        await tx.product.update({
          where: { id: padre.id },
          data: {
            hasVariants: true,
            // el padre no se vende: pierde su código propio para que el lector
            // no lo encuentre y no quede stock colgando en él
            sku: null,
            barcode: null,
            ...(variantOptions ? { variantOptions } : {}),
          },
        })
        await tx.inventory.deleteMany({ where: { productId: padre.id } })
      } else if (variantOptions) {
        await tx.product.update({ where: { id: padre.id }, data: { variantOptions } })
      }

      // Revalidado DENTRO de la transacción (no solo antes de abrirla): un
      // doble clic en "Guardar" puede llegar con dos peticiones casi
      // simultáneas que vieron la misma lista de variantes existentes y
      // ambas creerían que ninguna se repite.
      const existentesTx = await tx.product.findMany({
        where: { parentId: padre.id, businessId: session.user.businessId },
        select: { variantLabel: true },
      })
      const yaHayTx = new Set(existentesTx.map((v) => (v.variantLabel ?? '').toLowerCase()))
      const repetida = nuevas.find((v) => yaHayTx.has(v.label.toLowerCase()))
      if (repetida) {
        throw new VariantAlreadyExistsError(repetida.label)
      }

      const salida = []
      for (let i = 0; i < nuevas.length; i++) {
        const v = nuevas[i]
        // el stock que tenía el producto suelto se le queda a la primera
        const heredado = convirtiendo && i === 0 ? stockHeredado : []
        const inventarios = heredado.length
          ? heredado
          : branchId
            ? [{ branchId, quantity: v.initialStock ?? 0, minStock: v.minStock ?? 0 }]
            : []

        const creada = await tx.product.create({
          data: {
            name: `${padre.name} · ${v.label}`,
            description: padre.description,
            barcode: v.barcode?.trim() || null,
            sku: v.sku?.trim().toUpperCase() || null,
            price: v.price ?? padre.price,
            cost: v.cost ?? padre.cost,
            taxRate: padre.taxRate,
            unitOfMeasure: padre.unitOfMeasure,
            supplier: padre.supplier,
            imageUrl: padre.imageUrl,
            businessId: session.user.businessId,
            categoryId: padre.categoryId,
            parentId: padre.id,
            variantLabel: v.label,
            ...(inventarios.length && { inventory: { create: inventarios } }),
          },
        })
        salida.push(creada.id)
      }
      return salida
    })

    return NextResponse.json({ creadas: creadas.length, convertido: convirtiendo }, { status: 201 })
  } catch (error) {
    if (error instanceof VariantAlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('POST /api/products/[id]/variants error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
