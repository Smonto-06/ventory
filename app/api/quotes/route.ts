import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, badRequest, serverError } from '@/lib/api-helpers'
import { lineValue, cartSubtotal, resolvedDiscount, saleTotal } from '@/lib/pos'
import { incluirCotizacion as incluir, serializarCotizacion as serializar } from '@/lib/cotizaciones'

export const dynamic = 'force-dynamic'

// Cotizaciones.
//
// Una cotización es una promesa de precio, no una venta: NO mueve inventario,
// NO mueve caja y NO consume folio de facturación. Ese es su contrato y hay
// pruebas que lo verifican. Solo al convertirla se crea una venta por el
// camino normal (/api/sales), que sí descuenta stock y registra el dinero.

const CrearSchema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().nullish(),
  customerName: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(400).nullish(),
  /// Días que se respeta el precio; por defecto 8
  validDays: z.number().int().min(1).max(180).optional(),
  discount: z.number().nonnegative().optional(),
  discountIsPct: z.boolean().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive('La cantidad debe ser mayor a 0'),
        unitPrice: z.number().nonnegative(),
        discountPct: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1, 'Agrega al menos un producto'),
})

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('status')
    const q = searchParams.get('q')?.trim()

    const cotizaciones = await db.quote.findMany({
      where: {
        businessId: user.businessId,
        ...(estado === 'OPEN' ? { status: 'OPEN' } : {}),
        ...(estado === 'CONVERTED' ? { status: 'CONVERTED' } : {}),
        ...(estado === 'CANCELLED' ? { status: 'CANCELLED' } : {}),
        ...(q
          ? {
              OR: [
                { folio: { contains: q, mode: 'insensitive' } },
                { customerName: { contains: q, mode: 'insensitive' } },
                { customer: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: incluir,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ quotes: cotizaciones.map(serializar) })
  } catch (error) {
    return serverError('GET /api/quotes', error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) return unauthorized()

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return badRequest('JSON inválido')
    }
    const parsed = CrearSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)
    const { branchId, customerId, customerName, notes, validDays, discount, discountIsPct, items } = parsed.data

    const sucursal = await db.branch.findFirst({
      where: { id: branchId, businessId: user.businessId, isActive: true },
      select: { id: true },
    })
    if (!sucursal) return badRequest('Sucursal no encontrada')

    // Los productos deben ser del negocio y vendibles: un agrupador de
    // variantes no se cotiza, se cotiza la variante concreta.
    const ids = Array.from(new Set(items.map((i) => i.productId)))
    const productos = await db.product.findMany({
      where: { id: { in: ids }, businessId: user.businessId },
      select: { id: true, hasVariants: true, name: true },
    })
    if (productos.length !== ids.length) return badRequest('Algún producto no existe en este negocio')
    const agrupador = productos.find((p) => p.hasVariants)
    if (agrupador) return badRequest(`"${agrupador.name}" tiene variantes: elige una`)

    if (customerId) {
      const cli = await db.customer.findFirst({
        where: { id: customerId, businessId: user.businessId },
        select: { id: true },
      })
      if (!cli) return badRequest('Cliente no encontrado')
    }

    // Las mismas reglas de lib/pos.ts que usa el cobro: si el cliente vuelve,
    // el total de la venta tiene que coincidir con el que se le cotizó.
    const cartLines = items.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discountPct: i.discountPct ?? 0,
    }))
    const lineas = items.map((i, n) => ({ ...i, total: lineValue(cartLines[n]) }))
    const subtotal = cartSubtotal(cartLines)
    const descuento = resolvedDiscount(cartLines, discount ?? 0, !!discountIsPct)
    const total = saleTotal(cartLines, discount ?? 0, !!discountIsPct)

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (validDays ?? 8))
    validUntil.setHours(23, 59, 59, 999)

    const creada = await db.$transaction(async (tx) => {
      // Consecutivo atómico, igual que el de las ventas: dos cajas cotizando
      // a la vez no pueden generar el mismo número.
      const filas = await tx.$queryRaw<Array<{ quoteSeq: number }>>`
        UPDATE "branches" SET "quoteSeq" = "quoteSeq" + 1 WHERE "id" = ${branchId} RETURNING "quoteSeq"`
      const folio = `COT-${String(filas[0].quoteSeq).padStart(6, '0')}`

      return tx.quote.create({
        data: {
          folio,
          businessId: user.businessId,
          branchId,
          customerId: customerId ?? null,
          customerName: customerName?.trim() || null,
          notes: notes?.trim() || null,
          validUntil,
          subtotal,
          discountAmount: descuento,
          discountIsPct: !!discountIsPct,
          discountPct: discountIsPct ? (discount ?? 0) : 0,
          total,
          createdById: user.id,
          items: {
            create: lineas.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPct: l.discountPct ?? 0,
              total: l.total,
            })),
          },
        },
        include: incluir,
      })
    })

    db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entity: 'Quote',
          entityId: creada.id,
          payload: { folio: creada.folio, total: Number(creada.total) },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ quote: serializar(creada) }, { status: 201 })
  } catch (error) {
    return serverError('POST /api/quotes', error)
  }
}
