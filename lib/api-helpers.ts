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

/**
 * La caja abierta del usuario que hace la operación (para movimientos de
 * caja generados por otras operaciones: devoluciones, abonos, compras…).
 * Cada usuario abre/cierra SU turno — nunca la "más reciente de la
 * sucursal": con dos cajeros abiertos a la vez en la misma sucursal, eso
 * metía el movimiento de uno en el cajón físico del otro.
 */
export async function findOpenCashSession(client: Tx | typeof db, branchId: string, openedById: string) {
  return client.cashSession.findFirst({
    where: { branchId, status: CashSessionStatus.OPEN, openedById },
  })
}

/** Sucursal por defecto del negocio (la del usuario o la primera activa) */
export async function resolveBranchId(
  businessId: string,
  requested?: string | null,
): Promise<string | null> {
  if (requested) {
    const branch = await db.branch.findFirst({ where: { id: requested, businessId, isActive: true } })
    return branch?.id ?? null
  }
  const branch = await db.branch.findFirst({
    where: { businessId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  return branch?.id ?? null
}

/**
 * Resuelve el proveedor de un producto por nombre (texto libre del
 * formulario/CSV) contra la tabla real Supplier — creándolo si no existe, o
 * reactivándolo si estaba archivado. Mismo patrón que ya usa la creación de
 * compras (app/api/purchases/route.ts): sin este enlace, `Product.supplierId`
 * quedaba siempre vacío y la pantalla de Proveedores mostraba 0 productos
 * para todos, sin importar cuántos tuvieran ese proveedor en el texto libre.
 */
export async function resolveOrCreateSupplier(
  client: Tx | typeof db,
  businessId: string,
  name: string,
): Promise<string> {
  const trimmed = name.trim()
  let supplier = await client.supplier.findFirst({
    where: { businessId, name: { equals: trimmed, mode: 'insensitive' } },
  })
  if (!supplier) {
    supplier = await client.supplier.create({ data: { name: trimmed, businessId } })
  } else if (!supplier.isActive) {
    supplier = await client.supplier.update({ where: { id: supplier.id }, data: { isActive: true } })
  }
  return supplier.id
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
