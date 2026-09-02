import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { serialize } from '@/lib/api-helpers'
import { requireActiveBusiness } from '@/lib/plan'
import {
  lineValue,
  cartSubtotal,
  saleTotal,
  resolvedDiscount,
  includedIva,
  resolvePayment,
} from '@/lib/pos'
import { CashSessionStatus, MovementType, PaymentMethod, Prisma } from '@prisma/client'
import { moveStock, InsufficientStockError } from '@/lib/inventory'

export const dynamic = 'force-dynamic'

/** La cotización ya estaba convertida o anulada: se aborta toda la venta */
class QuoteNoConvertible extends Error {
  constructor() {
    super('Cotización no convertible')
    this.name = 'QuoteNoConvertible'
  }
}

const ItemSchema = z.object({
  productId: z.string().min(1),
  // Decimal para productos vendidos por peso (p. ej. 0.75 kg)
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  // Descuento por artículo en % (0–100)
  discountPct: z.number().min(0).max(100).default(0),
})

// Cobro combinado: Efectivo/Tarjeta/Transferencia con montos por método.
// Crédito es exclusivo (paymentMethod = CREDIT, sin split).
const PaymentsSchema = z.object({
  cashActive: z.boolean().default(true),
  cashReceived: z.number().nonnegative().default(0),
  card: z.number().nonnegative().default(0),
  transfer: z.number().nonnegative().default(0),
})

const CreateSaleSchema = z.object({
  cashSessionId: z.string().min(1),
  items: z.array(ItemSchema).min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'MIXED', 'CREDIT']).default('CASH'),
  // Nuevo: split de cobro combinado. Si se omite, se usa el flujo legado amountPaid.
  payments: PaymentsSchema.optional(),
  amountPaid: z.number().nonnegative().default(0),
  // Descuento global: $ (discountIsPct=false) o % (discountIsPct=true) — excluyentes
  discount: z.number().nonnegative().default(0),
  discountIsPct: z.boolean().default(false),
  // Compatibilidad con clientes anteriores que envían discountAmount en $
  discountAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  customerId: z.string().optional(),
  // Cotización de la que sale esta venta: al cobrarla queda marcada como
  // convertida y ligada a la venta, dentro de la misma transacción.
  quoteId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = CreateSaleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { cashSessionId, items, paymentMethod, payments, notes, customerId, quoteId } = parsed.data
  const discount = parsed.data.discountAmount ?? parsed.data.discount
  const discountIsPct = parsed.data.discountAmount !== undefined ? false : parsed.data.discountIsPct
  const businessId = session.user.businessId
  const cashierId = session.user.id

  // Prueba vencida o plan suspendido → no se puede vender
  const planBlock = await requireActiveBusiness(businessId)
  if (planBlock) return planBlock

  try {
    // Caja por usuario: cada quien vende contra SU propio turno abierto, no
    // el de otro cajero (aunque esté abierto en la misma sucursal) — si no,
    // el efectivo cobrado por uno termina en el cierre de otro.
    const cashSession = await db.cashSession.findFirst({
      where: {
        id: cashSessionId,
        status: CashSessionStatus.OPEN,
        openedById: cashierId,
        branch: { businessId },
      },
    })
    if (!cashSession) {
      return NextResponse.json(
        { error: 'Caja no encontrada o ya cerrada. Abre una caja antes de registrar ventas.' },
        { status: 400 },
      )
    }
    const branchId = cashSession.branchId

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { allowNegativeStock: true, ivaPct: true },
    })
    const allowNegativeStock = business?.allowNegativeStock ?? false
    const ivaPct = Number(business?.ivaPct ?? 0)

    const productIds = items.map((i) => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds }, businessId, status: 'ACTIVE' },
    })
    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Uno o más productos no encontrados o inactivos' },
        { status: 400 },
      )
    }
    // Un agrupador de variantes no se vende (no tiene stock propio): se
    // vende la variante concreta. Mismo guard que ya aplica quotes/route.ts.
    const agrupador = products.find((p) => p.hasVariants)
    if (agrupador) {
      return NextResponse.json(
        { error: `"${agrupador.name}" tiene variantes: elige una para vender` },
        { status: 400 },
      )
    }
    const productMap = new Map(products.map((p) => [p.id, p]))

    // El cliente (crédito o solo asociado a una venta de contado) debe ser
    // del mismo negocio: el id es un cuid global, no compuesto con
    // businessId, así que sin este chequeo se podría fiar o adjuntar a un
    // cliente de OTRO negocio (fuga de datos + saldo corrupto ajeno).
    if (customerId) {
      const customer = await db.customer.findFirst({ where: { id: customerId, businessId } })
      if (!customer) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 400 })
      }
    }

    const inventoryRecords = await db.inventory.findMany({
      where: { productId: { in: productIds }, branchId },
    })
    const inventoryMap = new Map(inventoryRecords.map((inv) => [inv.productId, inv]))

    if (!allowNegativeStock) {
      for (const item of items) {
        const inv = inventoryMap.get(item.productId)
        if (!inv || Number(inv.quantity) < item.quantity) {
          const product = productMap.get(item.productId)
          return NextResponse.json(
            {
              error: `Stock insuficiente para "${product?.name ?? item.productId}". Disponible: ${inv?.quantity ?? 0}, Requerido: ${item.quantity}`,
              code: 'INSUFFICIENT_STOCK',
              productId: item.productId,
              available: inv?.quantity ?? 0,
              required: item.quantity,
            },
            { status: 422 },
          )
        }
      }
    }

    // Totales con las reglas del prototipo (COP enteros, descuentos por ítem y global)
    const cartLines = items.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discountPct: i.discountPct,
    }))
    const subtotal = cartSubtotal(cartLines)
    const total = saleTotal(cartLines, discount, discountIsPct)
    const discountValue = resolvedDiscount(cartLines, discount, discountIsPct)
    // IVA incluido en el precio — solo informativo, no se suma al total
    const taxAmount = includedIva(total, ivaPct)

    // Resolución del cobro
    let amountPaid: number
    let changeGiven = 0
    let salePayments: Array<{ method: PaymentMethod; amount: number }> = []
    let resolvedMethod: PaymentMethod = paymentMethod

    if (paymentMethod === 'CREDIT') {
      if (!customerId) {
        return NextResponse.json(
          { error: 'El pago a crédito requiere seleccionar un cliente.' },
          { status: 400 },
        )
      }
      amountPaid = total
      salePayments = [{ method: 'CREDIT', amount: total }]
    } else if (payments) {
      const resolution = resolvePayment(total, {
        card: payments.card,
        transfer: payments.transfer,
        cashActive: payments.cashActive,
        received: payments.cashReceived,
      })
      if (!resolution.covered) {
        return NextResponse.json(
          { error: `Monto insuficiente. Total: $${total}, cubierto: $${payments.card + payments.transfer + (payments.cashActive ? payments.cashReceived : 0)}` },
          { status: 400 },
        )
      }
      changeGiven = resolution.change
      amountPaid = payments.card + payments.transfer + (payments.cashActive ? payments.cashReceived : 0)
      if (payments.card > 0) salePayments.push({ method: 'CARD', amount: Math.round(payments.card) })
      if (payments.transfer > 0)
        salePayments.push({ method: 'TRANSFER', amount: Math.round(payments.transfer) })
      if (payments.cashActive && resolution.cashCollected > 0)
        salePayments.push({ method: 'CASH', amount: resolution.cashCollected })
      // Solo efectivo por el total exacto también cuenta como pago
      if (salePayments.length === 0 && total === 0) {
        salePayments.push({ method: 'CASH', amount: 0 })
      }
      resolvedMethod =
        salePayments.length > 1 ? 'MIXED' : (salePayments[0]?.method ?? 'CASH')
    } else {
      // Flujo legado: un solo método con amountPaid
      amountPaid = parsed.data.amountPaid
      if (amountPaid < total) {
        return NextResponse.json(
          { error: `Monto insuficiente. Total: $${total}, Recibido: $${amountPaid}` },
          { status: 400 },
        )
      }
      changeGiven = paymentMethod === 'CASH' ? Math.max(0, amountPaid - total) : 0
      salePayments = [{ method: paymentMethod, amount: total }]
    }

    const sale = await db.$transaction(async (tx) => {
      // Consecutivo F-XXXXXX realmente atómico: UPDATE … RETURNING toma el
      // lock de la sucursal, así dos cajas vendiendo al mismo tiempo obtienen
      // números distintos en vez de chocar y perder una de las ventas.
      const seqRows = await tx.$queryRaw<Array<{ saleSeq: number }>>`
        UPDATE "branches" SET "saleSeq" = "saleSeq" + 1
        WHERE "id" = ${branchId}
        RETURNING "saleSeq"
      `
      const folio = `F-${String(seqRows[0].saleSeq).padStart(6, '0')}`

      const newSale = await tx.sale.create({
        data: {
          folio,
          status: 'COMPLETED',
          subtotal,
          taxAmount,
          discountAmount: discountValue,
          discountIsPct,
          discountPct: discountIsPct ? discount : 0,
          total,
          paymentMethod: resolvedMethod,
          amountPaid: paymentMethod === 'CREDIT' ? total : amountPaid,
          changeGiven,
          notes,
          branchId,
          cashierId,
          cashSessionId,
          customerId: customerId || undefined,
        },
      })

      for (const payment of salePayments) {
        await tx.salePayment.create({
          data: { saleId: newSale.id, method: payment.method, amount: payment.amount },
        })
      }

      for (const item of items) {
        const product = productMap.get(item.productId)!
        const line = { unitPrice: item.unitPrice, quantity: item.quantity, discountPct: item.discountPct }
        const lineTotal = lineValue(line)
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct,
            // Costo snapshot para reportes de utilidad
            costPrice: product.cost ?? 0,
            taxRate: 0,
            taxAmount: 0,
            subtotal: lineTotal,
            total: lineTotal,
          },
        })

        // Descuento ATÓMICO: la BD resta sobre el valor real del momento.
        // Si otra caja consumió el stock justo ahora, la venta completa se
        // revierte en vez de dejar el inventario descuadrado.
        const move = await moveStock(tx, item.productId, branchId, -item.quantity)
        if (!allowNegativeStock && move.after < 0) {
          throw new InsufficientStockError(product.name, move.before, item.quantity)
        }
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.SALE,
            quantity: item.quantity,
            quantityBefore: move.before,
            quantityAfter: move.after,
            reason: `Venta ${folio}`,
            inventoryId: move.inventoryId,
            saleItemId: saleItem.id,
            createdById: cashierId,
          },
        })
      }

      // Venta a crédito → cliente.saldo += total
      if (paymentMethod === 'CREDIT' && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: total } },
        })
      }

      // Cotización convertida. El updateMany con status OPEN es la garantía de
      // que solo se convierte una vez: si dos cajas cobran la misma cotización
      // al tiempo, la segunda no encuentra fila que actualizar y se revierte
      // toda la venta, en vez de duplicar el cobro.
      if (quoteId) {
        const marcadas = await tx.quote.updateMany({
          where: { id: quoteId, businessId, status: 'OPEN' },
          data: { status: 'CONVERTED', convertedAt: new Date(), saleId: newSale.id },
        })
        if (marcadas.count === 0) {
          throw new QuoteNoConvertible()
        }
      }

      return tx.sale.findUnique({
        where: { id: newSale.id },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } } } },
          payments: true,
          cashier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
      })
    })

    db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entity: 'Sale',
          entityId: sale!.id,
          payload: { folio: sale!.folio, total: String(sale!.total), items: items.length },
          userId: cashierId,
        },
      })
      .catch(() => {})

    return NextResponse.json({ sale: serialize(sale) }, { status: 201 })
  } catch (error) {
    // Carrera perdida contra otra venta del mismo producto: nada quedó a medias
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'INSUFFICIENT_STOCK',
          available: error.available,
          required: error.required,
        },
        { status: 422 },
      )
    }
    if (error instanceof QuoteNoConvertible) {
      return NextResponse.json(
        { error: 'Esa cotización ya no está disponible: puede estar anulada o ya convertida', code: 'QUOTE_UNAVAILABLE' },
        { status: 409 },
      )
    }
    console.error('[POST /api/sales]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cashSessionId = searchParams.get('cashSessionId')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const q = searchParams.get('q')?.trim()
  const businessId = session.user.businessId

  const where: Prisma.SaleWhereInput = { branch: { businessId } }
  if (cashSessionId) where.cashSessionId = cashSessionId
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {}
    if (dateFrom) createdAt.gte = new Date(dateFrom)
    if (dateTo) createdAt.lte = new Date(dateTo)
    where.createdAt = createdAt
  }
  if (q) {
    where.OR = [
      { folio: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      { items: { some: { product: { name: { contains: q, mode: 'insensitive' } } } } },
    ]
  }

  const sales = await db.sale.findMany({
    where,
    include: {
      items: { include: { product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } } } },
      payments: true,
      returns: { include: { items: true } },
      cashier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ sales: serialize(sales) })
}
