import { NextResponse } from 'next/server'
import { UserRole, CashSessionStatus, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/get-session'

export function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

export function forbidden(msg = 'No tienes permiso para esta operación') {
  return NextResponse.json({ error: msg }, { status: 403 })
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export function serverError(context: string, error: unknown) {
  console.error(`[${context}]`, error)
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
}

/** Rol cajero no ve Compras, Proveedores, Movimientos, Reportes ni Ajustes */
export function isAdmin(user: SessionUser): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR
}

/**
 * Solo el ADMIN pleno (el dueño). El encargado (SUPERVISOR) opera el negocio
 * —compras, inventario, reportes— pero no toca usuarios, ajustes del
 * negocio, el plan ni los respaldos.
 */
export function isFullAdmin(user: SessionUser): boolean {
  return user.role === UserRole.ADMIN
}

type Tx = Prisma.TransactionClient

/** Sesión de caja abierta de una sucursal (para movimientos de caja generados por otras operaciones) */
export async function findOpenCashSession(client: Tx | typeof db, branchId: string) {
  return client.cashSession.findFirst({
    where: { branchId, status: CashSessionStatus.OPEN },
    orderBy: { openedAt: 'desc' },
  })
}

/** Sucursal por defecto del negocio (la del usuario o la primera activa) */
export async function resolveBranchId(
  businessId: string,
  requested?: string | null,
): Promise<string | null> {
  if (requested) {
    const branch = await db.branch.findFirst({ where: { id: requested, businessId } })
    return branch?.id ?? null
  }
  const branch = await db.branch.findFirst({
    where: { businessId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  return branch?.id ?? null
}

/** Serializa Decimals de Prisma a number recursivamente para respuestas JSON */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value === 'object') {
    if (value instanceof Date) return value
    if (Prisma.Decimal.isDecimal(value)) return Number(value) as unknown as T
    if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v)
    }
    return out as T
  }
  return value
}
