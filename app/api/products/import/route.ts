import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Importación masiva de productos desde la plantilla CSV.
// Duplicados (por nombre, SKU o código de barras) se omiten y se reportan.

const RowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().positive(),
  cost: z.number().nonnegative().optional(),
  category: z.string().trim().max(100).optional(),
  sku: z.string().trim().max(50).optional(),
  barcode: z.string().trim().max(50).optional(),
  stock: z.number().nonnegative().default(0),
  minStock: z.number().nonnegative().default(0),
  unit: z.enum(['und', 'kg']).default('und'),
  supplier: z.string().trim().max(200).optional(),
})

const ImportSchema = z.object({
  rows: z.array(RowSchema).min(1, 'El archivo no tiene filas válidas').max(1000, 'Máximo 1000 productos por importación'),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }
    const businessId = session.user.businessId

    const body = await request.json()
    const parsed = ImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const rows = parsed.data.rows

    const branch = await db.branch.findFirst({ where: { businessId, isActive: true } })
    if (!branch) return NextResponse.json({ error: 'El negocio no tiene sucursal' }, { status: 400 })

    // Índices de duplicados existentes
    const existing = await db.product.findMany({
      where: { businessId },
      select: { name: true, sku: true, barcode: true },
    })
    const byName = new Set(existing.map((p) => p.name.trim().toLowerCase()))
    const bySku = new Set(existing.filter((p) => p.sku).map((p) => p.sku!.trim().toUpperCase()))
    const byBarcode = new Set(existing.filter((p) => p.barcode).map((p) => p.barcode!.trim()))

    // Categorías: resolver por nombre, creando las que falten
    const categories = await db.category.findMany({ where: { businessId } })
    const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]))
    const newCatNames = new Set<string>()
    for (const r of rows) {
      const cn = r.category?.trim()
      if (cn && !catByName.has(cn.toLowerCase())) newCatNames.add(cn)
    }
    for (const cn of Array.from(newCatNames)) {
      const cat = await db.category.create({ data: { name: cn, businessId } })
      catByName.set(cn.trim().toLowerCase(), cat.id)
    }

    const skipped: Array<{ name: string; reason: string }> = []
    let created = 0

    // Filtrado + deduplicación (también dentro del propio archivo)
    const toCreate: typeof rows = []
    for (const r of rows) {
      const nameKey = r.name.trim().toLowerCase()
      const skuKey = r.sku?.trim().toUpperCase() || null
      const barcodeKey = r.barcode?.trim() || null
      if (byName.has(nameKey)) {
        skipped.push({ name: r.name, reason: 'Ya existe un producto con ese nombre' })
        continue
      }
      if (skuKey && bySku.has(skuKey)) {
        skipped.push({ name: r.name, reason: `SKU ${skuKey} ya existe` })
        continue
      }
      if (barcodeKey && byBarcode.has(barcodeKey)) {
        skipped.push({ name: r.name, reason: `Código de barras ${barcodeKey} ya existe` })
        continue
      }
      byName.add(nameKey)
      if (skuKey) bySku.add(skuKey)
      if (barcodeKey) byBarcode.add(barcodeKey)
      toCreate.push(r)
    }

    // Creación por lotes (transacciones de 100 para no exceder timeouts)
    for (let i = 0; i < toCreate.length; i += 100) {
      const chunk = toCreate.slice(i, i + 100)
      await db.$transaction(async (tx) => {
        for (const r of chunk) {
          await tx.product.create({
            data: {
              name: r.name.trim(),
              sku: r.sku?.trim().toUpperCase() || null,
              barcode: r.barcode?.trim() || null,
              price: r.price,
              cost: r.cost ?? null,
              unitOfMeasure: r.unit === 'kg' ? 'kg' : null,
              supplier: r.supplier?.trim() || null,
              taxRate: 0,
              businessId,
              categoryId: r.category?.trim() ? catByName.get(r.category.trim().toLowerCase()) ?? null : null,
              inventory: {
                create: { branchId: branch.id, quantity: r.stock, minStock: r.minStock },
              },
            },
          })
          created++
        }
      })
    }

    db.auditLog
      .create({
        data: {
          action: 'IMPORT',
          entity: 'Product',
          entityId: businessId,
          payload: { created, skipped: skipped.length },
          userId: session.user.id,
        },
      })
      .catch(() => {})

    return NextResponse.json({ created, skipped, total: rows.length })
  } catch (error) {
    console.error('POST /api/products/import error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
