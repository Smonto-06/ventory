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
 * condicionado a status PENDING garantiza que el webhook y la consulta de
 * respaldo no sumen los 30 días dos veces por el mismo pago.
 */
export async function aplicarPagoAprobado(
  paymentId: string,
  datos: { wompiId?: string; paymentMethod?: string; finalizedAt?: string | null },
): Promise<boolean> {
  const DIA = 86400000
  return db.$transaction(async (tx) => {
    const cambiado = await tx.planPayment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        wompiId: datos.wompiId,
        paymentMethod: datos.paymentMethod,
        paidAt: datos.finalizedAt ? new Date(datos.finalizedAt) : new Date(),
      },
    })
    if (cambiado.count === 0) return false // ya se había aplicado
    const pago = await tx.planPayment.findUniqueOrThrow({ where: { id: paymentId }, select: { businessId: true } })
    const negocio = await tx.business.findUniqueOrThrow({
      where: { id: pago.businessId },
      select: { status: true, trialEndsAt: true, paidUntil: true, activatedAt: true },
    })
    const ahora = Date.now()
    // Base: lo que aún tenga vigente (mensualidad o días de prueba restantes)
    const base = Math.max(
      ahora,
      negocio.paidUntil?.getTime() ?? 0,
      negocio.status === 'TRIAL' ? negocio.trialEndsAt?.getTime() ?? 0 : 0,
    )
    await tx.business.update({
      where: { id: pago.businessId },
      data: {
        status: 'ACTIVE',
        paidUntil: new Date(base + 30 * DIA),
        activatedAt: negocio.activatedAt ?? new Date(),
      },
    })
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
