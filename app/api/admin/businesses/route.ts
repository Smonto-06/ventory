import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden } from '@/lib/api-helpers'
import { planInfo, isSuperAdmin } from '@/lib/plan'

export const dynamic = 'force-dynamic'

// Panel del super-admin (dueño de la plataforma): lista todos los negocios
// registrados con su plan, actividad y contadores.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isSuperAdmin(user.email)) return forbidden('Solo el administrador de la plataforma')

  const businesses = await db.business.findMany({
    include: {
      users: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      _count: { select: { products: true, customers: true } },
      branches: {
        select: {
          _count: { select: { sales: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Última venta por negocio (actividad real)
  const lastSales = await db.sale.groupBy({
    by: ['branchId'],
    _max: { createdAt: true },
  })
  const branchOwners = await db.branch.findMany({ select: { id: true, businessId: true } })
  const branchToBusiness = new Map(branchOwners.map((b) => [b.id, b.businessId]))
  const lastSaleByBusiness = new Map<string, Date>()
  for (const row of lastSales) {
    const bizId = branchToBusiness.get(row.branchId)
    if (!bizId || !row._max.createdAt) continue
    const prev = lastSaleByBusiness.get(bizId)
    if (!prev || row._max.createdAt > prev) lastSaleByBusiness.set(bizId, row._max.createdAt)
  }

  return NextResponse.json({
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      activatedAt: b.activatedAt,
      adminNotes: b.adminNotes,
      plan: planInfo(b),
      owner: b.users.find((u) => u.role === 'ADMIN') ?? b.users[0] ?? null,
      userCount: b.users.length,
      productCount: b._count.products,
      customerCount: b._count.customers,
      salesCount: b.branches.reduce((sum, br) => sum + br._count.sales, 0),
      lastSaleAt: lastSaleByBusiness.get(b.id) ?? null,
    })),
  })
}
