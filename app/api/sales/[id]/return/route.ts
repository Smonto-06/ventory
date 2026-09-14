import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import {
  unauthorized,
  badRequest,
  serverError,
  findOpenCashSession,
  serialize,
} from '@/lib/api-helpers'
import { CashMovementType, MovementType } from '@prisma/client'
import { moveStock } from '@/lib/inventory'
import { cashPortion, allocateProportional } from '@/lib/pos'

export const dynamic = 'force-dynamic'

/** Otra devolución concurrente ya alcanzó (o superó) el tope vendido de esa línea */
class OverReturnedError extends Error {
  constructor() {
    super('Esa cantidad ya se devolvió por otra operación simultánea')
    this.name = 'OverReturnedError'
  }
}

/** La venta se anuló justo mientras se procesaba esta devolución */
class SaleVoidedError extends Error {
  constructor() {
    super('La venta se anuló mientras se registraba la devolución')
    this.name = 'SaleVoidedError'
  }
}

/** El turno al que iba el reembolso en efectivo se cerró justo en este instante */
class CashSessionClosedError extends Error {
  constructor() {
    super('La caja se cerró mientras se registraba la devolución. Vuelve a intentar.')
    this.name = 'CashSessionClosedError'
  }
}

/** Dentro de la transacción se determinó que sí hace falta efectivo, pero no hay caja abierta */
class NoOpenSessionError extends Error {
  constructor() {
    super('No hay caja abierta. Abre un turno antes de registrar devoluciones.')
    this.name = 'NoOpenSessionError'
  }
}

const ReturnSchema = z.object({
  items: z
    .array(
      z.object({
        saleItemId: z.string().min(1),
        quantity: z.number().positive(),
      }),
    )
    .min(1, 'Indica los artículos a devolver'),
  // false = devolución (reembolso en efectivo → gasto de caja)
  // true  = cambio (el valor devuelto se aplica como descuento $ en una nueva venta)
  exchange: z.boolean().default(false),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = ReturnSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { exchange, notes } = parsed.data

  try {
    const sale = await db.sale.findFirst({
      where: { id: params.id, branch: { businessId: user.businessId } },
      include: { items: true, payments: true, returns: { select: { totalRefund: true } } },
    })
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (sale.status === 'CANCELLED') return badRequest('La venta está anulada')

    // Tope por línea: lo vendido menos lo ya devuelto. Es un límite del
    // documento, no del inventario: sirve para no reembolsar más plata de la
    // que se cobró en esa factura.
    //
    // Las cantidades se comparan en gramos (enteros) porque los productos por
    // peso llevan decimales, y sumar 0,8 + 0,7 en coma flotante puede dar
    // 1,4999999 y rechazar una devolución legítima.
    const aMil = (n: unknown) => Math.round(Number(n) * 1000)

    // El total de cada línea (SaleItem.total) se guarda ANTES del descuento
    // global de la venta — Sale.discountAmount solo existe a nivel de venta,
    // nunca se prorratea hacia atrás en cada línea. Sin este ajuste, una
    // devolución reembolsaba el valor de catálogo de la línea (sin
    // descuento) en vez de lo que el cliente realmente pagó por ella,
    // dejando el cajón corto en exactamente el monto del descuento cada vez
    // que se devuelve algo de una venta con descuento global.
    //
    // allocateProportional() reparte sale.total entre TODAS las líneas de
    // la venta (no solo las que se están devolviendo ahora) con reparto de
    // resto determinístico: así la suma de los "itemDiscountedTotal" de
    // todas las líneas da EXACTAMENTE sale.total, sin importar en cuántas
    // devoluciones separadas se termine devolviendo la venta completa.
    // Redondear cada línea por separado (round(item.total*total/subtotal))
    // podía dejar $1-2 cobrados de más que nunca quedaban disponibles para
    // devolver, aunque se devolviera TODA la venta.
    const saleTotalNum = Number(sale.total)
    const discountedTotalByItem = allocateProportional(
      saleTotalNum,
      sale.items.map((i) => ({ id: i.id, weight: Number(i.total) })),
    )

    const itemMap = new Map(sale.items.map((i) => [i.id, i]))
    const toReturn: Array<{
      saleItemId: string
      productId: string
      quantity: number
      pedidoMil: number
      totalMil: number
      itemDiscountedTotal: number
    }> = []
    for (const r of parsed.data.items) {
      const item = itemMap.get(r.saleItemId)
      if (!item) return badRequest('Artículo no pertenece a esta venta')

      const disponibleMil = aMil(item.quantity) - aMil(item.returnedQty)
      const pedidoMil = aMil(r.quantity)
      if (pedidoMil <= 0) continue
      if (pedidoMil > disponibleMil) {
        return badRequest(
          `No se puede devolver más de lo vendido en esa línea (quedan ${disponibleMil / 1000})`,
        )
      }

      toReturn.push({
        saleItemId: item.id,
        productId: item.productId,
        quantity: pedidoMil / 1000,
        pedidoMil,
        totalMil: aMil(item.quantity),
        itemDiscountedTotal: discountedTotalByItem.get(item.id) ?? 0,
      })
    }
    if (toReturn.length === 0) {
      return badRequest('No hay cantidades disponibles para devolver')
    }

    // Estimado previo a la transacción, solo para decidir de forma rápida si
    // hace falta caja abierta y dar el error correspondiente sin abrir
    // transacción. El valor con el que de verdad se contabiliza el
    // reembolso se recalcula DENTRO de la transacción (ver más abajo), a
    // partir del valor real que devuelve el UPDATE atómico de returnedQty —
    // así una devolución concurrente de la misma línea nunca deja este
    // estimado desactualizado en el monto que realmente se registra.
    const estimadoTotalRefund = toReturn.reduce((sum, r) => {
      const prevMil = aMil(itemMap.get(r.saleItemId)!.returnedQty)
      const nuevoMil = prevMil + r.pedidoMil
      const antes = Math.round((r.itemDiscountedTotal * prevMil) / r.totalMil)
      const despues = Math.round((r.itemDiscountedTotal * nuevoMil) / r.totalMil)
      return sum + (despues - antes)
    }, 0)

    // Solo la parte de la venta que SÍ entró en efectivo sale del cajón al
    // devolver; tarjeta/transferencia se reembolsan por fuera y no lo tocan
    // (misma regla que cashPortion() ya aplica para las ventas). El efectivo
    // a sacar del cajón se telescopa sobre el ACUMULADO de reembolsos de
    // toda la venta (no solo el de esta llamada) — ver el mismo cálculo
    // repetido dentro de la transacción con el acumulado fresco, más abajo:
    // este de aquí es solo el estimado para decidir si hace falta caja
    // abierta antes de arrancar la transacción.
    const saleCashPortion = cashPortion({
      total: saleTotalNum,
      paymentMethod: sale.paymentMethod,
      payments: sale.payments,
    })
    const refundedAntes = sale.returns.reduce((s, r) => s + Number(r.totalRefund), 0)
    const refundedDespues = refundedAntes + estimadoTotalRefund
    const estimadoCashRefund =
      saleTotalNum > 0
        ? Math.round((refundedDespues * saleCashPortion) / saleTotalNum) -
          Math.round((refundedAntes * saleCashPortion) / saleTotalNum)
        : 0

    // La devolución (no el cambio) reembolsa la parte en efectivo: requiere caja abierta
    let cashSessionId: string | null = null
    if (!exchange && estimadoCashRefund > 0) {
      const cashSession = await findOpenCashSession(db, sale.branchId, user.id)
      if (!cashSession) {
        return badRequest('No hay caja abierta. Abre un turno antes de registrar devoluciones.')
      }
      cashSessionId = cashSession.id
    }

    const saleReturn = await db.$transaction(async (tx) => {
      // Lock consultivo por venta: serializa esta devolución contra una
      // anulación (void) concurrente de la MISMA venta — sin esto, void podía
      // leer returnedQty/las devoluciones previas justo antes de que esta
      // termine, y devolver stock o reembolsar efectivo con datos vencidos
      // (ver void/route.ts, que toma el mismo lock).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sale.id}))`
      const vigente = await tx.sale.findUnique({ where: { id: sale.id }, select: { status: true } })
      if (vigente?.status === 'CANCELLED') {
        throw new SaleVoidedError()
      }

      const items: Array<{ saleItemId: string; productId: string; quantity: number; refund: number }> = []

      for (const r of toReturn) {
        const move = await moveStock(tx, r.productId, sale.branchId, r.quantity)
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.RETURN,
            quantity: r.quantity,
            quantityBefore: move.before,
            quantityAfter: move.after,
            reason: `${exchange ? 'Cambio' : 'Devolución'} ${sale.folio}`,
            inventoryId: move.inventoryId,
            saleItemId: r.saleItemId,
            createdById: user.id,
          },
        })
        // Incremento CONDICIONADO al valor vigente de returnedQty (no al que
        // se leyó al validar, fuera de la transacción): si dos devoluciones
        // de la misma línea llegan casi simultáneas, la segunda encuentra
        // 0 filas afectadas y se revierte entera, en vez de dejar
        // returnedQty por encima de lo vendido y pagar el reembolso dos veces.
        const updated = await tx.$queryRaw<Array<{ returnedQty: unknown }>>`
          UPDATE "sale_items"
          SET "returnedQty" = "returnedQty" + ${r.quantity}
          WHERE "id" = ${r.saleItemId} AND "returnedQty" + ${r.quantity} <= "quantity"
          RETURNING "returnedQty"
        `
        if (updated.length === 0) {
          throw new OverReturnedError()
        }

        // El reembolso de esta línea se calcula como la DIFERENCIA entre el
        // reembolso acumulado "hasta ahora" y "hasta antes de esta
        // operación", ambos redondeados con la misma fórmula sobre el total
        // ya prorrateado por descuento — igual que el saldo de una cuenta:
        // la suma de reembolsos de N devoluciones parciales de la misma
        // línea SIEMPRE da exactamente itemDiscountedTotal cuando se agota
        // la cantidad vendida, sin importar cuántos cortes intermedios haya
        // ni dónde caigan los ".5". Calcularlo como una fracción
        // independiente en cada devolución (la fórmula anterior) podía
        // desviarse ±$1 por redondeo cuando la cantidad se partía en más de
        // una devolución (p. ej. 0.5kg + 0.5kg de un producto por peso).
        const nuevoMil = aMil(updated[0].returnedQty)
        const prevMil = nuevoMil - r.pedidoMil
        const antes = Math.round((r.itemDiscountedTotal * prevMil) / r.totalMil)
        const despues = Math.round((r.itemDiscountedTotal * nuevoMil) / r.totalMil)
        items.push({
          saleItemId: r.saleItemId,
          productId: r.productId,
          quantity: r.quantity,
          refund: despues - antes,
        })
      }

      const totalRefund = items.reduce((sum, it) => sum + it.refund, 0)

      // Mismo truco telescópico que el reembolso por línea, pero aplicado al
      // efectivo de TODA la venta: se lee el acumulado real de devoluciones
      // previas (fresco, ya con el lock tomado) y el gasto de caja de esta
      // llamada es la diferencia entre "efectivo que debería haber salido
      // hasta ahora" y "hasta antes de esta devolución" — así el total de
      // efectivo sacado del cajón a lo largo de N devoluciones separadas de
      // la misma venta siempre coincide con lo que hubiera salido
      // devolviendo todo en una sola llamada, sin importar dónde caigan los
      // redondeos de cada una por separado.
      const previas = await tx.saleReturn.aggregate({
        where: { saleId: sale.id },
        _sum: { totalRefund: true },
      })
      const refundedAntesTx = Number(previas._sum.totalRefund ?? 0)
      const refundedDespuesTx = refundedAntesTx + totalRefund
      const cashRefund =
        saleTotalNum > 0
          ? Math.round((refundedDespuesTx * saleCashPortion) / saleTotalNum) -
            Math.round((refundedAntesTx * saleCashPortion) / saleTotalNum)
          : 0

      // Devolución → gasto de caja por la parte en efectivo. Cambio → sin gasto
      // (se aplica como descuento en nueva venta).
      let cashMovementId: string | null = null
      if (!exchange && cashRefund > 0) {
        // El estimado previo a la transacción pudo no encontrar caja abierta
        // (devolución solo de artículos sin parte en efectivo) mientras que
        // el valor real sí la necesita, o viceversa: se resuelve de nuevo
        // aquí dentro si hace falta, sobre el estado actual.
        let targetSessionId = cashSessionId
        if (!targetSessionId) {
          const fallbackSession = await findOpenCashSession(tx, sale.branchId, user.id)
          if (!fallbackSession) {
            throw new NoOpenSessionError()
          }
          targetSessionId = fallbackSession.id
        }
        // Lock consultivo por turno: serializa contra un cierre de caja
        // concurrente del MISMO turno (mismo patrón que sales/route.ts y
        // cash-registers/[id]/close/route.ts).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${targetSessionId}))`
        const sesionVigente = await tx.cashSession.findUnique({
          where: { id: targetSessionId },
          select: { status: true },
        })
        if (sesionVigente?.status !== 'OPEN') {
          throw new CashSessionClosedError()
        }
        const movement = await tx.cashMovement.create({
          data: {
            type: CashMovementType.EXPENSE,
            amount: cashRefund,
            description: 'Devolución',
            comment: sale.folio,
            cashSessionId: targetSessionId,
            createdById: user.id,
          },
        })
        cashMovementId = movement.id
      }

      // Venta a crédito: la parte devuelta deja de deberse, sin importar si
      // es devolución con reembolso o cambio (mismo criterio que void/route.ts
      // al anular la venta completa). Sin esto, devolver parte de una venta a
      // crédito no tocaba Customer.balance y el cliente quedaba cobrado de
      // más por artículos que ya devolvió.
      if (sale.paymentMethod === 'CREDIT' && sale.customerId && totalRefund > 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: totalRefund } },
        })
      }

      const created = await tx.saleReturn.create({
        data: {
          type: exchange ? 'EXCHANGE' : 'REFUND',
          totalRefund,
          notes,
          saleId: sale.id,
          cashMovementId,
          createdById: user.id,
          items: {
            create: items.map((it) => ({
              saleItemId: it.saleItemId,
              quantity: it.quantity,
              refundAmount: it.refund,
            })),
          },
        },
        include: { items: true },
      })
      return { created, totalRefund }
    })

    db.auditLog
      .create({
        data: {
          action: exchange ? 'EXCHANGE' : 'RETURN',
          entity: 'Sale',
          entityId: sale.id,
          payload: { folio: sale.folio, totalRefund: saleReturn.totalRefund, items: toReturn.length },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json(
      {
        return: serialize(saleReturn.created),
        // Para "cambio": el frontend aplica este valor como descuento $ en la nueva venta
        creditForExchange: exchange ? saleReturn.totalRefund : 0,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof OverReturnedError || error instanceof SaleVoidedError || error instanceof NoOpenSessionError) {
      return badRequest(error.message)
    }
    if (error instanceof CashSessionClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return serverError('POST /api/sales/[id]/return', error)
  }
}
