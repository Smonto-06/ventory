import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { resolveOrCreateSupplier } from '@/lib/api-helpers'

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

// Solo se valida la forma general acá (es un arreglo, dentro del tope de
// 1000); cada fila se valida por separado más abajo. Antes UNA fila mal
// formada (precio no numérico, unidad inválida, etc.) tumbaba con un solo
// mensaje genérico las 1000 filas del archivo, sin decir cuál era la mala
// ni procesar las que sí estaban bien.
const ImportSchema = z.object({
  rows: z.array(z.unknown()).min(1, 'El archivo no tiene filas válidas').max(1000, 'Máximo 1000 productos por importación'),
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

    const skipped: Array<{ name: string; reason: string }> = []

    // Cada fila se valida por separado: una fila mal formada se reporta con
    // su número y se salta, sin tumbar el resto del archivo.
    const rows: Array<z.infer<typeof RowSchema>> = []
    parsed.data.rows.forEach((raw, i) => {
      const r = RowSchema.safeParse(raw)
      if (!r.success) {
        const nombre = typeof (raw as { name?: unknown })?.name === 'string' ? (raw as { name: string }).name : `fila ${i + 2}`
        skipped.push({ name: nombre, reason: `Fila ${i + 2}: ${r.error.issues[0].message}` })
        return
      }
      // Mismo chequeo que la creación manual de productos: el costo no puede
      // superar el precio de venta.
      if (r.data.cost !== undefined && r.data.cost > r.data.price) {
        skipped.push({ name: r.data.name, reason: `Fila ${i + 2}: el costo no puede ser mayor al precio de venta` })
        return
      }
      rows.push(r.data)
    })

    if (rows.length === 0) {
      return NextResponse.json({ created: 0, skipped, total: parsed.data.rows.length })
    }

    // Misma sucursal "primera activa" que usa el resto del sistema
    // (resolveBranchId, lib/api-helpers.ts) — un findFirst sin orderBy no
    // garantiza cuál sucursal elige el motor, así que el stock importado
    // podía terminar en una sucursal distinta entre corridas.
    const branch = await db.branch.findFirst({ where: { businessId, isActive: true }, orderBy: { createdAt: 'asc' } })
    if (!branch) return NextResponse.json({ error: 'El negocio no tiene sucursal' }, { status: 400 })

    // Índices de duplicados existentes
    const existing = await db.product.findMany({
      where: { businessId },
      select: { name: true, sku: true, barcode: true },
    })
    const byName = new Set(existing.map((p) => p.name.trim().toLowerCase()))
    const bySku = new Set(existing.filter((p) => p.sku).map((p) => p.sku!.trim().toUpperCase()))
    const byBarcode = new Set(existing.filter((p) => p.barcode).map((p) => p.barcode!.trim()))

    // Categorías: resolver por nombre, creando las que falten. Solo activas:
    // reutilizar el id de una archivada por nombre asignaría productos
    // nuevos a una categoría que el negocio ya no usa, sin reactivarla.
    const categories = await db.category.findMany({ where: { businessId, isActive: true } })
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

    // Proveedores: igual que las categorías, resolver/crear por nombre antes
    // del lote — sin esto Product.supplierId quedaba siempre vacío y la
    // pantalla de Proveedores nunca mostraba los productos importados.
    const supplierNames = new Set<string>()
    for (const r of toCreate) {
      const sn = r.supplier?.trim()
      if (sn) supplierNames.add(sn)
    }
    const supplierIdByName = new Map<string, string>()
    for (const sn of Array.from(supplierNames)) {
      const id = await resolveOrCreateSupplier(db, businessId, sn)
      supplierIdByName.set(sn.toLowerCase(), id)
    }

    // Creación por lotes (transacciones de 100 para no exceder timeouts)
    for (let i = 0; i < toCreate.length; i += 100) {
      const chunk = toCreate.slice(i, i + 100)
      await db.$transaction(async (tx) => {
        for (const r of chunk) {
          const supplierName = r.supplier?.trim() || null
          await tx.product.create({
            data: {
              name: r.name.trim(),
              sku: r.sku?.trim().toUpperCase() || null,
              barcode: r.barcode?.trim() || null,
              price: r.price,
              cost: r.cost ?? null,
              unitOfMeasure: r.unit === 'kg' ? 'kg' : null,
              supplier: supplierName,
              supplierId: supplierName ? supplierIdByName.get(supplierName.toLowerCase()) ?? null : null,
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
