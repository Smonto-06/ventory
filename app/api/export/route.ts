import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/get-session'
import { unauthorized, forbidden, badRequest, isFullAdmin } from '@/lib/api-helpers'

const METHOD_ES: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
  MIXED: 'Mixto',
}
function methodLabel(method: string, payments: Array<{ method: string }>): string {
  if (method === 'MIXED' && payments.length) {
    return payments.map((p) => METHOD_ES[p.method] ?? p.method).join(' + ')
  }
  return METHOD_ES[method] ?? method
}

export const dynamic = 'force-dynamic'

// Exportación de datos del negocio:
//   /api/export?type=sales|products|customers|purchases  → CSV (Excel es-CO: ; y BOM)
//   /api/export?type=backup                              → JSON con todo el negocio

const BOM = '﻿'

function csv(rows: Array<Array<string | number | null | undefined>>): string {
  return (
    BOM +
    rows
      .map((r) =>
        r
          .map((c) => {
            const v = c === null || c === undefined ? '' : String(c)
            return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
          })
          .join(';'),
      )
      .join('\n')
  )
}

function csvResponse(content: string, filename: string) {
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

const fdate = (d: Date) =>
  d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return unauthorized()
  if (!isFullAdmin(user)) return forbidden('Solo el administrador exporta datos')
  const businessId = user.businessId

  const type = req.nextUrl.searchParams.get('type') ?? ''
  const stamp = new Date().toISOString().slice(0, 10)

  if (type === 'products') {
    const products = await db.product.findMany({
      where: { businessId },
      include: { category: { select: { name: true } }, inventory: { select: { quantity: true, minStock: true } } },
      orderBy: { name: 'asc' },
    })
    const rows: Array<Array<string | number>> = [
      ['nombre', 'precio', 'costo', 'categoria', 'sku', 'codigo_barras', 'stock', 'stock_minimo', 'unidad', 'proveedor', 'estado'],
    ]
    for (const p of products) {
      const stock = p.inventory.reduce((s, i) => s + Number(i.quantity), 0)
      const minStock = p.inventory.length ? Math.max(...p.inventory.map((i) => Number(i.minStock))) : 0
      rows.push([
        p.name, Number(p.price), p.cost ? Number(p.cost) : 0, p.category?.name ?? '', p.sku ?? '', p.barcode ?? '',
        stock, minStock, p.unitOfMeasure === 'kg' ? 'kg' : 'und', p.supplier ?? '', p.status,
      ])
    }
    return csvResponse(csv(rows), `ventory-inventario-${stamp}.csv`)
  }

  if (type === 'customers') {
    const customers = await db.customer.findMany({ where: { businessId }, orderBy: { name: 'asc' } })
    const rows: Array<Array<string | number>> = [['nombre', 'telefono', 'documento', 'direccion', 'saldo_credito']]
    for (const c of customers) {
      rows.push([c.name, c.phone ?? '', c.document ?? '', c.address ?? '', Number(c.balance)])
    }
    return csvResponse(csv(rows), `ventory-clientes-${stamp}.csv`)
  }

  if (type === 'sales') {
    const sales = await db.sale.findMany({
      where: { branch: { businessId } },
      include: {
        cashier: { select: { name: true } },
        customer: { select: { name: true } },
        payments: { select: { method: true, amount: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })
    const rows: Array<Array<string | number>> = [
      ['fecha', 'factura', 'estado', 'cajero', 'cliente', 'metodo', 'articulos', 'subtotal', 'descuento', 'total', 'iva_incluido'],
    ]
    for (const v of sales) {
      rows.push([
        fdate(v.createdAt), v.folio, v.status === 'COMPLETED' ? 'completada' : v.status === 'CANCELLED' ? 'anulada' : 'devuelta',
        v.cashier?.name ?? '', v.customer?.name ?? '',
        methodLabel(v.paymentMethod, v.payments.map((p) => ({ method: p.method }))),
        v.items.reduce((s, i) => s + Number(i.quantity), 0),
        Number(v.subtotal), Number(v.discountAmount), Number(v.total), Number(v.taxAmount),
      ])
    }
    return csvResponse(csv(rows), `ventory-ventas-${stamp}.csv`)
  }

  if (type === 'purchases') {
    const purchases = await db.purchase.findMany({
      where: { businessId },
      include: { supplier: { select: { name: true } }, items: { select: { quantity: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })
    const rows: Array<Array<string | number>> = [
      ['fecha', 'proveedor', 'metodo', 'articulos', 'total', 'abonado', 'saldo_pendiente'],
    ]
    for (const c of purchases) {
      rows.push([
        fdate(c.createdAt), c.supplier.name,
        c.method === 'CASH' ? 'contado' : c.method === 'TRANSFER' ? 'transferencia' : 'crédito',
        c.items.reduce((s, i) => s + Number(i.quantity), 0),
        Number(c.total), Number(c.paidAmount), Number(c.total) - Number(c.paidAmount),
      ])
    }
    return csvResponse(csv(rows), `ventory-compras-${stamp}.csv`)
  }

  if (type === 'backup') {
    // Respaldo completo del negocio en JSON (sin contraseñas ni tokens)
    const [business, products, categories, customers, suppliers, sales, purchases, cashSessions] =
      await Promise.all([
        db.business.findUnique({
          where: { id: businessId },
          select: { name: true, taxId: true, phone: true, address: true, receiptFooter: true, currency: true, ivaPct: true },
        }),
        db.product.findMany({
          where: { businessId },
          include: { category: { select: { name: true } }, inventory: { select: { quantity: true, minStock: true } } },
        }),
        db.category.findMany({ where: { businessId }, select: { name: true, isActive: true } }),
        db.customer.findMany({ where: { businessId } }),
        db.supplier.findMany({ where: { businessId } }),
        db.sale.findMany({
          where: { branch: { businessId } },
          include: {
            items: { include: { product: { select: { name: true } } } },
            payments: true,
            cashier: { select: { name: true } },
            customer: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20000,
        }),
        db.purchase.findMany({
          where: { businessId },
          include: { items: { include: { product: { select: { name: true } } } }, supplier: { select: { name: true } }, payments: true },
          take: 20000,
        }),
        db.cashSession.findMany({
          where: { branch: { businessId } },
          include: { movements: true },
          orderBy: { openedAt: 'desc' },
          take: 2000,
        }),
      ])

    const decimalSafe = (obj: unknown): unknown => JSON.parse(JSON.stringify(obj))
    const payload = {
      exportadoEl: new Date().toISOString(),
      sistema: 'Ventory POS',
      negocio: decimalSafe(business),
      categorias: decimalSafe(categories),
      productos: decimalSafe(products),
      clientes: decimalSafe(customers),
      proveedores: decimalSafe(suppliers),
      ventas: decimalSafe(sales),
      compras: decimalSafe(purchases),
      turnosDeCaja: decimalSafe(cashSessions),
    }
    return new NextResponse(JSON.stringify(payload, null, 1), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="ventory-respaldo-${stamp}.json"`,
      },
    })
  }

  return badRequest('Tipo de exportación no válido')
}
