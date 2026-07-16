import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { calculateShiftClose, requiresObservation } from '@/lib/cash-session'
import { serialize } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const closeSchema = z.object({
  // Total contado físicamente (calculadora de billetes del prototipo)
  closingBalance: z.number().min(0, 'El monto contado no puede ser negativo'),
  closingNotes: z.string().optional(),
  // Abrir el siguiente turno de inmediato (prefill = contado)
  openNext: z.boolean().default(false),
  nextOpeningAmount: z.number().min(0).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const session = await db.cashSession.findFirst({
    where: { id: params.id, status: 'OPEN' },
    include: {
      // Solo ventas no anuladas del turno cuentan para el saldo esperado
      sales: {
        where: { status: 'COMPLETED' },
        select: { total: true, paymentMethod: true, payments: { select: { method: true, amount: true } } },
      },
      movements: { select: { type: true, amount: true } },
      openedBy: { select: { id: true, businessId: true } },
    },
  })

  if (!session) {
    return NextResponse.json(
      { error: 'Sesión de caja no encontrada o ya está cerrada' },
      { status: 404 },
    )
  }

  const isSameBusiness = session.openedBy.businessId === user.businessId
  const isOwnerOrSuperior =
    session.openedById === user.id ||
    user.role === 'ADMIN' ||
    user.role === 'SUPERVISOR'

  if (!isSameBusiness || !isOwnerOrSuperior) {
    return NextResponse.json({ error: 'No tienes permiso para cerrar esta caja' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const parsed = closeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { closingBalance, closingNotes, openNext, nextOpeningAmount } = parsed.data

  // Regla del prototipo: esperado = apertura + ventas del turno + ingresos − gastos
  const salesTotal = session.sales.reduce((sum, s) => sum + Number(s.total), 0)
  const incomes = session.movements
    .filter((m) => m.type === 'INCOME')
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const expenses = session.movements
    .filter((m) => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL')
    .reduce((sum, m) => sum + Number(m.amount), 0)

  const calc = calculateShiftClose(
    Number(session.openingBalance),
    salesTotal,
    incomes,
    expenses,
    closingBalance,
  )

  if (requiresObservation(calc.difference) && !closingNotes) {
    return NextResponse.json(
      {
        error: `Diferencia de ${calc.difference.toFixed(0)} COP supera el umbral. Observaciones obligatorias al cierre.`,
        expectedBalance: calc.expectedBalance,
        difference: calc.difference,
      },
      { status: 422 },
    )
  }

  const result = await db.$transaction(async (tx) => {
    const closed = await tx.cashSession.update({
      where: { id: params.id },
      data: {
        status: 'CLOSED',
        closingBalance,
        expectedBalance: calc.expectedBalance,
        difference: calc.difference,
        closingNotes,
        closedAt: new Date(),
        closedById: user.id,
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    })

    // Apertura del siguiente turno (prefill = contado, como el prototipo)
    let next = null
    if (openNext) {
      next = await tx.cashSession.create({
        data: {
          openingBalance: nextOpeningAmount ?? closingBalance,
          branchId: session.branchId,
          openedById: user.id,
          notes: 'Apertura tras cierre de turno',
        },
      })
    }

    return { closed, next }
  })

  db.auditLog
    .create({
      data: {
        action: 'CLOSE',
        entity: 'CashSession',
        entityId: params.id,
        payload: {
          expected: calc.expectedBalance,
          counted: closingBalance,
          difference: calc.difference,
        },
        userId: user.id,
      },
    })
    .catch(() => {})

  // Desglose del turno para el recibo de cierre: transacciones y ventas por método
  const byMethod: Record<string, number> = {}
  for (const sale of session.sales) {
    if (sale.payments.length > 0) {
      for (const p of sale.payments) {
        byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount)
      }
    } else {
      byMethod[sale.paymentMethod] = (byMethod[sale.paymentMethod] ?? 0) + Number(sale.total)
    }
  }

  return NextResponse.json({
    session: serialize(result.closed),
    nextSession: serialize(result.next),
    summary: {
      openingBalance: calc.openingBalance,
      salesTotal: calc.salesTotal,
      incomes: calc.incomes,
      expenses: calc.expenses,
      expectedBalance: calc.expectedBalance,
      countedBalance: calc.countedBalance,
      difference: calc.difference,
      status: calc.difference > 0 ? 'sobrante' : calc.difference < 0 ? 'faltante' : 'exacto',
    },
    report: {
      salesCount: session.sales.length,
      byMethod,
    },
  })
}
