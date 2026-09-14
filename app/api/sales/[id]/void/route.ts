import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import {
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  isAdmin,
  findOpenCashSession,
  serialize,
} from '@/lib/api-helpers'
import { CashMovementType, MovementType } from '@prisma/client'
import { moveStock } from '@/lib/inventory'
import { cashPortion } from '@/lib/pos'

export const dynamic = 'force-dynamic'

/** Otra anulación concurrente de la misma venta ya ganó la carrera */
class AlreadyVoidedError extends Error {
  constructor() {
    super('La venta ya está anulada')
    this.name = 'AlreadyVoidedError'
  }
}

/** El turno al que iba el gasto de caja se cerró justo en este instante */
class CashSessionClosedError extends Error {
  constructor() {
    super('La caja se cerró mientras se anulaba la venta. Vuelve a intentar.')
    this.name = 'CashSessionClosedError'
  }
}

/** Dentro de la transacción se determinó que sí hace falta efectivo, pero no hay caja abierta */
class NoOpenSessionError extends Error {
  constructor() {
    super('No hay caja abierta. Abre un turno antes de anular ventas.')
    this.name = 'NoOpenSessionError'
  }
}

const VoidSchema = z.object({ reason: z.string().optional() })

/**
 * Anulación de venta: regresa el stock restante (qty − retQty), registra gasto de caja
 * por la parte en efectivo no devuelta, y marca la venta como anulada (excluida de totales y
 * reportes; visible en historial). Si la venta fue a crédito, se revierte el saldo
 * del cliente en lugar de generar gasto de caja.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  // Anular (a diferencia de devolver) borra una venta YA completada: es el
  // punto clásico de fuga en un POS — cobrar en efectivo, embolsarse el
  // billete y anular la venta después para que no quede como descuadre. Se
  // exige el mismo nivel que ya protege compras y movimientos manuales de
  // caja (ADMIN/SUPERVISOR), a diferencia de la devolución (que sí es una
  // operación normal de mostrador: el cliente pide su plata de vuelta) y
  // por eso queda abierta a cualquier cajero.
  if (!isAdmin(user)) return forbidden('Solo un encargado puede anular una venta')

  let reason: string | undefined
  try {
    const body = await req.json()
    const parsed = VoidSchema.safeParse(body)
    if (parsed.success) reason = parsed.data.reason
  } catch {
    // cuerpo opcional
  }

  try {
    const sale = await db.sale.findFirst({
      where: { id: params.id, branch: { businessId: user.businessId } },
      include: { payments: true },
    })
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (sale.status === 'CANCELLED') return badRequest('La venta ya está anulada')

    const isCredit = sale.paymentMethod === 'CREDIT'
    const saleTotal = Number(sale.total)
    // Pagos y método no cambian después de creada la venta: es seguro leerlos
    // fuera de la transacción, a diferencia de returnedQty/returns (que sí
    // pueden estar mutando ahora mismo por una devolución concurrente).
    const saleCashPortion = cashPortion({ total: saleTotal, paymentMethod: sale.paymentMethod, payments: sale.payments })

    const voided = await db.$transaction(async (tx) => {
      // Lock consultivo por venta: serializa esta anulación contra una
      // devolución concurrente de la MISMA venta (return/route.ts toma el
      // mismo lock). Sin esto, esta anulación podía leer returnedQty y las
      // devoluciones previas justo ANTES de que una devolución en curso
      // termine de aplicarse — devolviendo stock que la devolución ya había
      // devuelto (inventario duplicado) y reembolsando efectivo sin
      // descontar lo que esa devolución ya reembolsó (caja de más).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sale.id}))`

      // Reclama la anulación PRIMERO y de forma condicionada al estado
      // vigente: si dos anulaciones de la misma venta llegan casi
      // simultáneas (doble clic, reintento de red), la segunda no encuentra
      // fila COMPLETED que actualizar y se revierte entera — nunca se
      // duplica el reintegro de stock ni el gasto de caja.
      const marcada = await tx.sale.updateMany({
        where: { id: sale.id, status: 'COMPLETED' },
        data: {
          status: 'CANCELLED',
          voidedAt: new Date(),
          voidedById: user.id,
          voidReason: reason,
        },
      })
      if (marcada.count === 0) {
        throw new AlreadyVoidedError()
      }

      // Estado fresco, leído DENTRO de la transacción y con el lock ya
      // tomado: ninguna devolución concurrente de esta venta puede estar a
      // medias en este punto (o ya terminó y se ve aquí completa, o todavía
      // no empezó y esperará este lock).
      const [freshItems, freshReturns] = await Promise.all([
        tx.saleItem.findMany({ where: { saleId: sale.id } }),
        tx.saleReturn.findMany({ where: { saleId: sale.id }, select: { totalRefund: true, cashMovementId: true } }),
      ])

      // Valor ya devuelto en devoluciones previas: se suma el totalRefund
      // real que quedó guardado en cada SaleReturn (calculado con la fórmula
      // de return/route.ts, ya prorrateada por descuento global), no una
      // reconstrucción con otra fórmula — dos redondeos distintos del mismo
      // valor pueden no coincidir y dejar $1 de más o de menos en el cajón.
      const refunded = freshReturns.reduce((sum, r) => sum + Number(r.totalRefund), 0)
      const refund = Math.max(0, saleTotal - refunded)

      // Solo la parte de la venta que SÍ entró en efectivo sale del cajón al
      // anular; tarjeta/transferencia no lo tocan (misma regla que
      // cashPortion() ya aplica para las ventas), proporcional a lo que
      // queda por anular.
      const cashRefund = saleTotal > 0 ? Math.round((refund * saleCashPortion) / saleTotal) : 0

      // Regresa el stock restante de cada artículo, usando returnedQty
      // recién leído (no el snapshot de antes de la transacción)
      for (const item of freshItems) {
        const remaining = Number(item.quantity) - Number(item.returnedQty)
        if (remaining <= 0) continue
        const move = await moveStock(tx, item.productId, sale.branchId, remaining)
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.RETURN,
            quantity: remaining,
            quantityBefore: move.before,
            quantityAfter: move.after,
            reason: `Anulación ${sale.folio}`,
            inventoryId: move.inventoryId,
            saleItemId: item.id,
            createdById: user.id,
          },
        })
      }

      // Las ventas ANULADAS se excluyen de "ventas en efectivo del turno"
      // (Sale.status ya no es COMPLETED), así que si la venta sigue en el
      // MISMO turno todavía abierto donde se hizo, esa exclusión YA le resta
      // su parte en efectivo al esperado — crear además un gasto de caja
      // restaría el mismo dinero dos veces. Solo hace falta el gasto cuando
      // el efectivo tiene que salir de un cajón DISTINTO al de la venta
      // original (turno ya cerrado, u otro cajero anulando desde su propio
      // turno).
      //
      // Pero esa exclusión asume que TODO el efectivo de la venta sigue "sin
      // devolver" — si ya hubo una o más devoluciones parciales en efectivo
      // ANTES de anular (mismo turno, todavía abierto), esos gastos de
      // "Devolución" siguen ahí Y la exclusión resta el total completo de la
      // venta: el efectivo ya devuelto se restaría dos veces. Se revierte con
      // un ingreso de ajuste por exactamente lo que ya se había devuelto EN
      // ESE MISMO turno (no en otro turno de otro cajero, que llevó su propio
      // efectivo y no depende de esta exclusión).
      const returnCashMovementIds = freshReturns.map((r) => r.cashMovementId).filter((id): id is string => !!id)
      if (returnCashMovementIds.length) {
        const sesionOriginal = await tx.cashSession.findUnique({
          where: { id: sale.cashSessionId },
          select: { id: true, status: true },
        })
        if (sesionOriginal?.status === 'OPEN') {
          // Lock consultivo por turno: mismo patrón que el resto de rutas de
          // caja (serializa contra un cierre concurrente de ESTE turno).
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sesionOriginal.id}))`
          const vigente = await tx.cashSession.findUnique({
            where: { id: sesionOriginal.id },
            select: { status: true },
          })
          if (vigente?.status === 'OPEN') {
            const devueltoEnEseTurno = await tx.cashMovement.aggregate({
              where: { id: { in: returnCashMovementIds }, cashSessionId: sesionOriginal.id },
              _sum: { amount: true },
            })
            const monto = Number(devueltoEnEseTurno._sum.amount ?? 0)
            if (monto > 0) {
              await tx.cashMovement.create({
                data: {
                  type: CashMovementType.INCOME,
                  amount: monto,
                  description: 'Ajuste por anulación',
                  comment: `${sale.folio} · reversa devolución previa de este turno`,
                  cashSessionId: sesionOriginal.id,
                  createdById: user.id,
                },
              })
            }
          }
        }
      }

      // Remanente en efectivo que TODAVÍA no se había devuelto: sale del
      // cajón actual del usuario que anula. Si ese cajón es el mismo turno
      // (original, todavía abierto) de la venta, la exclusión de arriba ya lo
      // cubre entero — no hace falta gasto propio.
      if (cashRefund > 0 && !isCredit) {
        const cashSession = await findOpenCashSession(tx, sale.branchId, user.id)
        if (!cashSession) {
          throw new NoOpenSessionError()
        }
        if (cashSession.id !== sale.cashSessionId) {
          // Lock consultivo por turno: serializa contra un cierre de caja
          // concurrente del MISMO turno (mismo patrón que sales/route.ts,
          // return/route.ts y cash-registers/[id]/close/route.ts).
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cashSession.id}))`
          const sesionVigente = await tx.cashSession.findUnique({
            where: { id: cashSession.id },
            select: { status: true },
          })
          if (sesionVigente?.status !== 'OPEN') {
            throw new CashSessionClosedError()
          }
          await tx.cashMovement.create({
            data: {
              type: CashMovementType.EXPENSE,
              amount: cashRefund,
              description: 'Anulación de venta',
              comment: sale.folio,
              cashSessionId: cashSession.id,
              createdById: user.id,
            },
          })
        }
      }

      // Venta a crédito: se revierte el saldo del cliente (no hubo efectivo de por medio)
      if (isCredit && sale.customerId && refund > 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: refund } },
        })
      }

      return {
        refund,
        sale: await tx.sale.findUniqueOrThrow({
          where: { id: sale.id },
          include: {
            items: { include: { product: { select: { id: true, name: true } } } },
            customer: { select: { id: true, name: true } },
          },
        }),
      }
    })

    db.auditLog
      .create({
        data: {
          action: 'VOID',
          entity: 'Sale',
          entityId: sale.id,
          payload: { folio: sale.folio, refund: voided.refund, reason: reason ?? null },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ sale: serialize(voided.sale), refund: voided.refund })
  } catch (error) {
    if (error instanceof AlreadyVoidedError || error instanceof NoOpenSessionError) {
      return badRequest(error.message)
    }
    if (error instanceof CashSessionClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return serverError('POST /api/sales/[id]/void', error)
  }
}
