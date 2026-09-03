// Plan comercial del negocio: prueba gratis de 15 días, activación manual por
// el super-admin (dueño de la plataforma), y suspensión con bloqueo suave
// (los datos se pueden consultar, pero no se puede vender/comprar/abrir caja).

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const TRIAL_DAYS = 15

export interface PlanInfo {
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED'
  trialEndsAt: string | null
  /** Vigencia pagada por Wompi; null en ACTIVE = activación manual sin vencer */
  paidUntil: string | null
  daysLeft: number | null
  blocked: boolean
}

export function planInfo(business: {
  status: string
  trialEndsAt: Date | null
  paidUntil?: Date | null
}): PlanInfo {
  const status = business.status as PlanInfo['status']
  if (status === 'ACTIVE') {
    const paid = business.paidUntil ?? null
    if (!paid) {
      // Activación manual del super admin: sin fecha de vencimiento
      return { status, trialEndsAt: null, paidUntil: null, daysLeft: null, blocked: false }
    }
    const msLeft = paid.getTime() - Date.now()
    return {
      status,
      trialEndsAt: null,
      paidUntil: paid.toISOString(),
      daysLeft: Math.max(0, Math.ceil(msLeft / 86400000)),
      blocked: msLeft <= 0,
    }
  }
  if (status === 'SUSPENDED') {
    return { status, trialEndsAt: null, paidUntil: null, daysLeft: null, blocked: true }
  }
  // TRIAL
  const ends = business.trialEndsAt
  const msLeft = ends ? ends.getTime() - Date.now() : 0
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000))
  return {
    status,
    trialEndsAt: ends?.toISOString() ?? null,
    paidUntil: null,
    daysLeft,
    blocked: msLeft <= 0,
  }
}

/**
 * Guard para endpoints de escritura (ventas, compras, abrir caja):
 * devuelve una respuesta 402 si el plan del negocio está bloqueado, o null si puede operar.
 */
export async function requireActiveBusiness(businessId: string): Promise<NextResponse | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { status: true, trialEndsAt: true, paidUntil: true },
  })
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }
  const info = planInfo(business)
  if (info.blocked) {
    const error =
      info.status === 'SUSPENDED'
        ? 'Tu plan está suspendido. Contáctanos para reactivarlo.'
        : info.status === 'ACTIVE'
          ? 'Tu mensualidad venció. Paga tu plan para seguir vendiendo.'
          : 'Tu prueba gratis terminó. Activa tu plan para seguir vendiendo.'
    return NextResponse.json({ error, code: 'PLAN_BLOCKED', plan: info }, { status: 402 })
  }
  return null
}

/**
 * Aplica un pago aprobado de Wompi: marca el PlanPayment y extiende la
 * vigencia 30 días sobre lo que quede (o sobre hoy si ya venció; si está en
 * prueba, los días de prueba restantes no se pierden). El updateMany
 * condicionado a status != APPROVED garantiza que el webhook y la consulta
 * de respaldo no sumen los 30 días dos veces por el mismo pago, PERO sigue
 * aplicando el pago si la referencia había quedado antes en DECLINED/VOIDED/
 * ERROR: tanto Wompi (Web Checkout) como Mercado Pago (Checkout Pro) dejan
 * reintentar un pago rechazado sin cambiar de referencia, así que un cobro
 * finalmente aprobado para una referencia ya declinada no puede perderse.
 */
export async function aplicarPagoAprobado(
  paymentId: string,
  datos: { wompiId?: string; paymentMethod?: string; finalizedAt?: string | null },
): Promise<boolean> {
  const DIA = 86400000
  return db.$transaction(async (tx) => {
    const pagoInicial = await tx.planPayment.findUniqueOrThrow({ where: { id: paymentId }, select: { businessId: true } })
    // Lock consultivo por negocio: aplicar un pago aprobado y revertir uno
    // (revertirPagoAprobado, más abajo) leen y escriben el mismo Business
    // sin bloquear la fila — dos webhooks casi simultáneos para el mismo
    // negocio (una aprobación y un contracargo de un pago distinto) podían
    // entrelazarse bajo READ COMMITTED y dejar el negocio en un estado que
    // no corresponde a ninguno de los dos eventos por separado. Serializa
    // cualquier cambio de estado de pago del mismo negocio.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pagoInicial.businessId}))`

    const cambiado = await tx.planPayment.updateMany({
      where: { id: paymentId, status: { not: 'APPROVED' } },
      data: {
        status: 'APPROVED',
        wompiId: datos.wompiId,
        paymentMethod: datos.paymentMethod,
        paidAt: datos.finalizedAt ? new Date(datos.finalizedAt) : new Date(),
      },
    })
    if (cambiado.count === 0) return false // ya se había aplicado
    const negocio = await tx.business.findUniqueOrThrow({
      where: { id: pagoInicial.businessId },
      select: { status: true, trialEndsAt: true, paidUntil: true, activatedAt: true },
    })
    // SUSPENDED es una decisión manual del super admin (app/api/admin/businesses/[id]/route.ts)
    // o automática por un contracargo/reembolso (ver revertirPagoAprobado
    // más abajo) — nunca un simple vencimiento. El pago queda registrado
    // como APPROVED (el cobro sí ocurrió), pero un pago que llega tarde
    // (reintento de un rechazo previo, con el guard de arriba ampliado a
    // "no está ya APPROVED") no puede reactivar por su cuenta un negocio
    // suspendido.
    if (negocio.status === 'SUSPENDED') return true

    const ahora = Date.now()
    // Base: lo que aún tenga vigente (mensualidad o días de prueba restantes)
    const base = Math.max(
      ahora,
      negocio.paidUntil?.getTime() ?? 0,
      negocio.status === 'TRIAL' ? negocio.trialEndsAt?.getTime() ?? 0 : 0,
    )
    await tx.business.update({
      where: { id: pagoInicial.businessId },
      data: {
        status: 'ACTIVE',
        paidUntil: new Date(base + 30 * DIA),
        activatedAt: negocio.activatedAt ?? new Date(),
      },
    })
    return true
  })
}

/**
 * Marca un pago como rechazado/anulado y, si ESE pago era el que sostenía el
 * acceso vigente del negocio (estaba APPROVED y ningún pago posterior lo
 * reemplazó), suspende el negocio de una. Cubre dos casos bien distintos con
 * el mismo estado final (DECLINED/VOIDED/ERROR):
 *  - Un intento que nunca llegó a aprobarse (rechazo inicial, o el reintento
 *    fallido de una referencia ya declinada): el negocio no cambia — nunca
 *    tuvo acceso por este pago.
 *  - Un reembolso o contracargo sobre un pago que SÍ estaba APPROVED: el
 *    dinero ya no está, así que el acceso tampoco debería seguir — decisión
 *    de producto explícita (no basta con "avisar y seguir activo").
 */
export async function revertirPagoAprobado(
  paymentId: string,
  nuevoEstado: 'DECLINED' | 'VOIDED' | 'ERROR',
  datos: { wompiId?: string; paymentMethod?: string },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const pago = await tx.planPayment.findUnique({
      where: { id: paymentId },
      select: { status: true, businessId: true, paidAt: true },
    })
    if (!pago) return false
    // Mismo lock que aplicarPagoAprobado — ver su comentario.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pago.businessId}))`
    const eraAprobado = pago.status === 'APPROVED'

    const cambiado = await tx.planPayment.updateMany({
      where: { id: paymentId, status: { not: nuevoEstado } },
      data: { status: nuevoEstado, wompiId: datos.wompiId, paymentMethod: datos.paymentMethod },
    })
    if (cambiado.count === 0) return false

    if (eraAprobado) {
      // Si el super admin activó el negocio a mano SIN vencimiento
      // (paidUntil null en ACTIVE — CLAUDE.md), su acceso no depende de
      // ningún PlanPayment puntual: un contracargo tardío sobre un pago
      // viejo (de una mensualidad ya superada hace tiempo) no puede
      // deshacer esa decisión manual.
      const negocio = await tx.business.findUnique({
        where: { id: pago.businessId },
        select: { paidUntil: true },
      })
      if (negocio && negocio.paidUntil === null) return true

      // ¿Sigue vigente el negocio por OTRO pago MÁS NUEVO que este? (p. ej.
      // ya pagó de nuevo el mes siguiente antes de que este contracargo
      // viejo llegara) — de ser así, no corresponde suspender por una
      // disputa sobre un cobro ya superado. No basta con "existe algún otro
      // pago aprobado": si el contracargo es sobre el pago MÁS RECIENTE (el
      // que de verdad sostiene paidUntil) y el negocio tiene otro aprobado
      // más VIEJO, ese viejo no cubre nada — ya se contó dentro de un
      // paidUntil que este mismo pago revertido extendió.
      const masReciente = await tx.planPayment.findFirst({
        where: {
          businessId: pago.businessId,
          status: 'APPROVED',
          ...(pago.paidAt ? { paidAt: { gt: pago.paidAt } } : {}),
        },
        orderBy: { paidAt: 'desc' },
      })
      if (!masReciente) {
        await tx.business.updateMany({
          where: { id: pago.businessId, status: 'ACTIVE' },
          data: { status: 'SUSPENDED' },
        })
      }
    }
    return true
  })
}

/** El super-admin de la plataforma se define por correo (SUPER_ADMIN_EMAIL en Vercel) */
export function isSuperAdmin(email: string | null | undefined): boolean {
  // Tolera comillas alrededor del valor (error común al pegar en Vercel)
  const configured = process.env.SUPER_ADMIN_EMAIL?.trim().replace(/^["']|["']$/g, '').trim().toLowerCase()
  return !!configured && !!email && email.trim().toLowerCase() === configured
}

/** Si la variable SUPER_ADMIN_EMAIL existe en este despliegue (para diagnóstico) */
export function superAdminConfigured(): boolean {
  return !!process.env.SUPER_ADMIN_EMAIL?.trim()
}
