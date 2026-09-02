// Resumen del día de un negocio: lo que se envía por correo al cierre.
//
// Se arma con las mismas reglas de lib/pos.ts que usan la pantalla de cierre y
// los reportes, para que el dueño no reciba por correo unas cifras y vea otras
// distintas al entrar al sistema.

import { db } from '@/lib/db'
import { cashPortion, profitReport, diaColombiano } from '@/lib/pos'

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
        paymentMethod: true,
        cashSessionId: true,
        payments: { select: { method: true, amount: true } },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            costPrice: true,
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
      select: { type: true, amount: true, cashSessionId: true },
    }),
    db.cashSession.findMany({
      where: { branch: { businessId }, openedAt: enElDia },
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

  // Costo snapshot de cada línea (SaleItem.costPrice), no el costo ACTUAL del
  // producto: si el costo cambió el mismo día (p. ej. tras una compra), usar
  // el valor en vivo desajusta esta utilidad frente a la que ya congelaron
  // /api/reports/daily y /api/reports/range para el mismo día.
  const costo = ventas.reduce(
    (a, v) => a + v.items.reduce((b, i) => b + Number(i.quantity) * Number(i.costPrice ?? 0), 0),
    0,
  )
  // Gastos operativos del día completo (todos los turnos) — es lo que resta
  // en la utilidad neta del negocio, sin importar en qué cajón se registraron.
  const gastos = movimientos
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((a, m) => a + Number(m.amount), 0)

  // "Caja por usuario" (CLAUDE.md) permite varios cajeros con turno propio
  // abierto AL MISMO TIEMPO: tomar solo uno con .find() (el primero que
  // encontrara la consulta) le escondía al dueño el saldo esperado de los
  // demás cajones abiertos esa noche. Se suman TODOS los turnos abiertos —
  // no cuenta lo de turnos ya cerrados antes (su efectivo ya se contó y se
  // retiró al cerrar).
  const abiertas = sesiones.filter((s) => s.status === 'OPEN')
  const apertura = abiertas.reduce((a, s) => a + Number(s.openingBalance), 0)
  const idsAbiertas = new Set(abiertas.map((s) => s.id))
  const movimientosTurno = movimientos.filter((m) => m.cashSessionId && idsAbiertas.has(m.cashSessionId))
  const ingresosTurno = movimientosTurno
    .filter((m) => m.type === 'INCOME')
    .reduce((a, m) => a + Number(m.amount), 0)
  const gastosTurno = movimientosTurno
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((a, m) => a + Number(m.amount), 0)
  const efectivoTurno = ventas
    .filter((v) => v.cashSessionId && idsAbiertas.has(v.cashSessionId))
    .reduce((a, v) => a + cashPortion({ ...v, total: Number(v.total) }), 0)

  const productos = new Map<string, { cantidad: number; total: number }>()
  for (const v of ventas) {
    for (const i of v.items) {
      const e = productos.get(i.product.name) ?? { cantidad: 0, total: 0 }
      e.cantidad += Number(i.quantity)
      e.total += Number(i.quantity) * Number(i.unitPrice)
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
    utilidad: { costo, gastos, neta: profitReport(total, costo, gastos).net },
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
