// Plan comercial del negocio: prueba gratis de 15 días, activación manual por
// el super-admin (dueño de la plataforma), y suspensión con bloqueo suave
// (los datos se pueden consultar, pero no se puede vender/comprar/abrir caja).

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const TRIAL_DAYS = 15

export interface PlanInfo {
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED'
  trialEndsAt: string | null
  daysLeft: number | null
  blocked: boolean
}

export function planInfo(business: {
  status: string
  trialEndsAt: Date | null
}): PlanInfo {
  const status = business.status as PlanInfo['status']
  if (status === 'ACTIVE') {
    return { status, trialEndsAt: null, daysLeft: null, blocked: false }
  }
  if (status === 'SUSPENDED') {
    return { status, trialEndsAt: null, daysLeft: null, blocked: true }
  }
  // TRIAL
  const ends = business.trialEndsAt
  const msLeft = ends ? ends.getTime() - Date.now() : 0
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000))
  return {
    status,
    trialEndsAt: ends?.toISOString() ?? null,
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
    select: { status: true, trialEndsAt: true },
  })
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }
  const info = planInfo(business)
  if (info.blocked) {
    return NextResponse.json(
      {
        error:
          info.status === 'SUSPENDED'
            ? 'Tu plan está suspendido. Contáctanos para reactivarlo.'
            : 'Tu prueba gratis terminó. Contáctanos para activar tu plan.',
        code: 'PLAN_BLOCKED',
        plan: info,
      },
      { status: 402 },
    )
  }
  return null
}

/** El super-admin de la plataforma se define por correo (SUPER_ADMIN_EMAIL en Vercel) */
export function isSuperAdmin(email: string | null | undefined): boolean {
  const configured = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
  return !!configured && !!email && email.trim().toLowerCase() === configured
}
