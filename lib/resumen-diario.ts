// Resumen del día de un negocio: lo que se envía por correo al cierre.
//
// Se arma con las mismas reglas de lib/pos.ts que usan la pantalla de cierre y
// los reportes, para que el dueño no reciba por correo unas cifras y vea otras
// distintas al entrar al sistema.

import { db } from '@/lib/db'
import { cashPortion, profitReport, diaColombiano, netSaleValue, isSaleRefundExpense } from '@/lib/pos'

export { diaColombiano }

export interface ResumenDiario {
  businessId: string
  negocio: string
  fecha: Date
  moneda: string
  ventas: { total: number; transacciones: number; promedio: number }
  porMetodo: { efectivo: number; tarjeta: number; transferencia: number; credito: number }
  utilidad: { costo: number; gastos: number; neta: number }
  caja: { apertura: number; ingresos: number; gastos: number; esperado: number; turnoAbierto: boolean; turnosAbiertos: number }
  cierres: Array<{ contado: number; esperado: number; diferencia: number; hora: string }>
  credito: { otorgado: number; abonado: number }
  compras: { total: number; cantidad: number }
  devoluciones: { total: number; cantidad: number }
  topProductos: Array<{ nombre: string; cantidad: number; total: number }>
  agotados: Array<{ nombre: string; stock: number; minimo: number; unidad: string | null }>
}

export async function construirResumen(businessId: string, referencia: Date): Promise<ResumenDiario | null> {
  const negocio = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, currency: true },
  })
  if (!negocio) return null

  const { desde, hasta, etiqueta } = diaColombiano(referencia)
  const enElDia = { gte: desde, lt: hasta }

  const [ventas, devoluciones, compras, abonos, movimientos, sesiones, inventario] = await Promise.all([
    db.sale.findMany({
      where: { branch: { businessId }, createdAt: enElDia, status: 'COMPLETED' },
      select: {
        total: true,
        subtotal: true,
        paymentMethod: true,
        cashSessionId: true,
        payments: { select: { method: true, amount: true } },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            total: true,
            costPrice: true,
            returnedQty: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    db.saleReturn.findMany({
      where: { sale: { branch: { businessId } }, createdAt: enElDia },
      select: { totalRefund: true },
    }),
    db.purchase.findMany({
      where: { businessId, createdAt: enElDia },
      select: { total: true },
    }),
    db.customerPayment.findMany({
      where: { customer: { businessId }, createdAt: enElDia },
      select: { amount: true },
    }),
    db.cashMovement.findMany({
      where: { cashSession: { branch: { businessId } }, createdAt: enElDia },
      select: { type: true, amount: true, cashSessionId: true, description: true },
    }),
    db.cashSession.findMany({
      // openedAt: enElDia trae los turnos (abiertos o cerrados) de HOY, pero
      // por sí solo se le escapa el caso más común de "se quedó la caja
      // abierta": un turno que un cajero abrió AYER (o antes) y nunca
      // cerró — sigue OPEN cuando corre el cron, pero openedAt ya no cae en
      // el día de hoy. El OR con status:'OPEN' lo incluye sin importar
      // cuándo se abrió.
      where: { branch: { businessId }, OR: [{ openedAt: enElDia }, { status: 'OPEN' }] },
      select: {
        id: true,
        status: true,
        openingBalance: true,
        closingBalance: true,
        expectedBalance: true,
        difference: true,
        closedAt: true,
      },
    }),
    db.inventory.findMany({
      where: { product: { businessId, status: 'ACTIVE', hasVariants: false } },
      select: {
        quantity: true,
        minStock: true,
        product: { select: { name: true, unitOfMeasure: true } },
      },
    }),
  ])

  const total = ventas.reduce((a, v) => a + Number(v.total), 0)
  const porMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0, credito: 0 }
  for (const v of ventas) {
    if (v.payments.length) {
      for (const p of v.payments) {
        if (p.method === 'CASH') porMetodo.efectivo += Number(p.amount)
        else if (p.method === 'CARD') porMetodo.tarjeta += Number(p.amount)
        else if (p.method === 'TRANSFER') porMetodo.transferencia += Number(p.amount)
        else if (p.method === 'CREDIT') porMetodo.credito += Number(p.amount)
      }
    } else {
      const t = Number(v.total)
      if (v.paymentMethod === 'CASH') porMetodo.efectivo += t
      else if (v.paymentMethod === 'CARD') porMetodo.tarjeta += t
      else if (v.paymentMethod === 'TRANSFER') porMetodo.transferencia += t
      else if (v.paymentMethod === 'CREDIT') porMetodo.credito += t
    }
  }

  // Neto de lo devuelto: un artículo que volvió no se vendió de verdad, ni su
  // costo ni su ingreso deberían contar en la utilidad. costPrice es el costo
  // guardado en la venta (no el costo actual del producto, que puede haber
  // cambiado desde entonces). netSaleValue() además prorratea el descuento
  // global de la venta (que SaleItem.total no incluye) — misma fórmula que
  // usan reports/daily y reports/range para que las cifras coincidan.
  const ventasNeto = ventas.reduce(
    (a, v) =>
      a +
      netSaleValue({
        subtotal: Number(v.subtotal),
        total: Number(v.total),
        items: v.items.map((i) => ({
          total: Number(i.total),
          quantity: Number(i.quantity),
          returnedQty: Number(i.returnedQty),
        })),
      }),
    0,
  )
  const costo = ventas.reduce(
    (a, v) =>
      a +
      v.items.reduce((b, i) => {
        const kept = Number(i.quantity) - Number(i.returnedQty)
        return b + Number(i.costPrice ?? 0) * Math.max(0, kept)
      }, 0),
    0,
  )
  // Se excluyen "Devolución"/"Anulación de venta" de la utilidad: esa venta
  // ya está neteada o excluida arriba (ventasNeto/costo), contar también su
  // reembolso de caja como gasto restaba la misma plata dos veces (ver
  // isSaleRefundExpense en lib/pos.ts). El total de "caja.gastos" (más abajo,
  // para el esperado del cajón) sí sigue contando el movimiento completo.
  const gastos = movimientos
    .filter((m) => (m.type === 'EXPENSE' || m.type === 'WITHDRAWAL') && !isSaleRefundExpense(m.description))
    .reduce((a, m) => a + Number(m.amount), 0)

  // "Caja por usuario" (CLAUDE.md) permite varios cajeros con turno propio
  // abierto AL MISMO TIEMPO: tomar solo uno con .find() (el primero que
  // encontrara la consulta) le escondía al dueño el saldo esperado de los
  // demás cajones abiertos esa noche. Se suman TODOS los turnos abiertos —
  // no cuenta lo de turnos ya cerrados antes (su efectivo ya se contó y se
  // retiró al cerrar).
  const abiertas = sesiones.filter((s) => s.status === 'OPEN')
  const apertura = abiertas.reduce((a, s) => a + Number(s.openingBalance), 0)
  const idsAbiertas = abiertas.map((s) => s.id)

  // El saldo esperado de un turno abierto es TODO lo que ha entrado desde que
  // se abrió, no solo lo de hoy: un turno abierto desde ayer (ver comentario
  // de `sesiones` arriba) tiene ventas y movimientos de ANTES de medianoche
  // que siguen físicamente en el cajón. `ventas`/`movimientos` de arriba están
  // acotados a `enElDia` para las métricas del día — para el esperado de caja
  // se pide aparte, por sesión completa, sin ese filtro de fecha.
  const [ventasTurno, movimientosTurno] = idsAbiertas.length
    ? await Promise.all([
        db.sale.findMany({
          where: { cashSessionId: { in: idsAbiertas }, status: 'COMPLETED' },
          select: {
            total: true,
            paymentMethod: true,
            cashSessionId: true,
            payments: { select: { method: true, amount: true } },
          },
        }),
        db.cashMovement.findMany({
          where: { cashSessionId: { in: idsAbiertas } },
          select: { type: true, amount: true, cashSessionId: true },
        }),
      ])
    : [[], []]
  const ingresosTurno = movimientosTurno
    .filter((m) => m.type === 'INCOME')
    .reduce((a, m) => a + Number(m.amount), 0)
  const gastosTurno = movimientosTurno
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((a, m) => a + Number(m.amount), 0)
  const efectivoTurno = ventasTurno.reduce((a, v) => a + cashPortion({ ...v, total: Number(v.total) }), 0)

  const productos = new Map<string, { cantidad: number; total: number }>()
  for (const v of ventas) {
    for (const i of v.items) {
      const e = productos.get(i.product.name) ?? { cantidad: 0, total: 0 }
      e.cantidad += Number(i.quantity)
      // i.total (no quantity×unitPrice): ya incluye el descuento por
      // artículo, igual que "top productos" en reports/daily — si no, el
      // correo mostraba más ingreso del que esa línea realmente dejó.
      e.total += Number(i.total)
      productos.set(i.product.name, e)
    }
  }

  const agotados = inventario
    .filter((i) => Number(i.quantity) <= 0 || (Number(i.minStock) > 0 && Number(i.quantity) <= Number(i.minStock)))
    .map((i) => ({
      nombre: i.product.name,
      stock: Number(i.quantity),
      minimo: Number(i.minStock),
      unidad: i.product.unitOfMeasure,
    }))
    .sort((a, b) => a.stock - b.stock)

  return {
    businessId,
    negocio: negocio.name,
    fecha: etiqueta,
    moneda: negocio.currency,
    ventas: {
      total,
      transacciones: ventas.length,
      promedio: ventas.length ? Math.round(total / ventas.length) : 0,
    },
    porMetodo,
    utilidad: { costo, gastos, neta: profitReport(ventasNeto, costo, gastos).net },
    caja: {
      apertura,
      ingresos: ingresosTurno,
      gastos: gastosTurno,
      esperado: apertura + efectivoTurno + ingresosTurno - gastosTurno,
      turnoAbierto: abiertas.length > 0,
      turnosAbiertos: abiertas.length,
    },
    cierres: sesiones
      .filter((s) => s.status !== 'OPEN' && s.closedAt)
      .map((s) => ({
        contado: Number(s.closingBalance ?? 0),
        esperado: Number(s.expectedBalance ?? 0),
        diferencia: Number(s.difference ?? 0),
        hora: s.closedAt!.toISOString(),
      })),
    credito: {
      otorgado: porMetodo.credito,
      abonado: abonos.reduce((a, p) => a + Number(p.amount), 0),
    },
    compras: { total: compras.reduce((a, c) => a + Number(c.total), 0), cantidad: compras.length },
    devoluciones: {
      total: devoluciones.reduce((a, d) => a + Number(d.totalRefund), 0),
      cantidad: devoluciones.length,
    },
    topProductos: Array.from(productos.entries())
      .map(([nombre, d]) => ({ nombre, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    agotados,
  }
}
