import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, serverError, isAdmin } from '@/lib/api-helpers'
import { planInfo, isSuperAdmin } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const UpdateSettingsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).max(5).optional(),
  // IVA % incluido en el precio (0–30 como el prototipo)
  ivaPct: z.number().min(0).max(30).optional(),
  defaultOpeningAmount: z.number().min(0).optional(),
  allowNegativeStock: z.boolean().optional(),
  barcodeEnabled: z.boolean().optional(),
  // Datos que aparecen en la factura de venta (vacío = no se imprime esa línea)
  taxId: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(160).optional(),
  receiptFooter: z.string().trim().max(160).optional(),
})

const BILLING_FIELDS = ['taxId', 'phone', 'address', 'receiptFooter'] as const

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()

  const business = await db.business.findUnique({
    where: { id: user.businessId },
    select: {
      id: true,
      name: true,
      currency: true,
      locale: true,
      ivaPct: true,
      defaultOpeningAmount: true,
      allowNegativeStock: true,
      barcodeEnabled: true,
      taxId: true,
      phone: true,
      address: true,
      receiptFooter: true,
      status: true,
      trialEndsAt: true,
    },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  return NextResponse.json({
    settings: {
      ...business,
      ivaPct: Number(business.ivaPct),
      defaultOpeningAmount: Number(business.defaultOpeningAmount),
      plan: planInfo(business),
      isSuperAdmin: isSuperAdmin(user.email),
    },
  })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden('Solo el administrador modifica los ajustes')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('JSON inválido')
  }
  const parsed = UpdateSettingsSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  // Campos de facturación: cadena vacía significa "quitar de la factura" → null
  const data: Record<string, unknown> = { ...parsed.data }
  for (const f of BILLING_FIELDS) {
    if (typeof data[f] === 'string' && data[f] === '') data[f] = null
  }

  try {
    const updated = await db.business.update({
      where: { id: user.businessId },
      data,
      select: {
        id: true,
        name: true,
        currency: true,
        locale: true,
        ivaPct: true,
        defaultOpeningAmount: true,
        allowNegativeStock: true,
        barcodeEnabled: true,
        taxId: true,
        phone: true,
        address: true,
        receiptFooter: true,
      },
    })

    db.auditLog
      .create({
        data: {
          action: 'UPDATE',
          entity: 'Business',
          entityId: user.businessId,
          payload: { fields: Object.keys(parsed.data) },
          userId: user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({
      settings: {
        ...updated,
        ivaPct: Number(updated.ivaPct),
        defaultOpeningAmount: Number(updated.defaultOpeningAmount),
      },
    })
  } catch (error) {
    return serverError('PUT /api/settings', error)
  }
}
