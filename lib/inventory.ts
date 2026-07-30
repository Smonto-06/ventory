import type { Prisma } from '@prisma/client'

/**
 * Stock insuficiente detectado DENTRO de la transacción: otra operación
 * consumió las unidades entre la validación previa y el descuento real.
 * Al lanzarse, la transacción completa se revierte — nunca queda una venta
 * registrada sin su descuento, ni stock en negativo sin autorización.
 */
export class InsufficientStockError extends Error {
  constructor(
    public productName: string,
    public available: number,
    public required: number,
  ) {
    super(
      `Stock insuficiente para "${productName}". Disponible: ${available}, requerido: ${required}`,
    )
    this.name = 'InsufficientStockError'
  }
}

export interface StockMove {
  inventoryId: string
  before: number
  after: number
}

/** Asegura que exista el registro de inventario sin tocar la cantidad */
async function ensureRow(
  tx: Prisma.TransactionClient,
  productId: string,
  branchId: string,
): Promise<void> {
  await tx.inventory.upsert({
    where: { productId_branchId: { productId, branchId } },
    create: { productId, branchId, quantity: 0 },
    update: {},
  })
}

/**
 * Mueve stock de forma ATÓMICA: la base de datos calcula
 * `quantity = quantity ± delta` sobre el valor real del momento (no sobre un
 * valor leído antes), así dos operaciones simultáneas sobre el mismo producto
 * no pueden sobrescribirse entre sí.
 *
 * delta negativo = salida (venta, traslado) · positivo = entrada (compra, devolución)
 */
export async function moveStock(
  tx: Prisma.TransactionClient,
  productId: string,
  branchId: string,
  delta: number,
): Promise<StockMove> {
  await ensureRow(tx, productId, branchId)

  const updated = await tx.inventory.update({
    where: { productId_branchId: { productId, branchId } },
    data: delta >= 0 ? { quantity: { increment: delta } } : { quantity: { decrement: -delta } },
  })

  const after = Number(updated.quantity)
  const low = after <= Number(updated.minStock)
  if (updated.lowStock !== low) {
    await tx.inventory.update({ where: { id: updated.id }, data: { lowStock: low } })
  }

  return { inventoryId: updated.id, before: after - delta, after }
}

/**
 * Fija el stock a un valor absoluto (conteo físico / ajuste). Bloquea la fila
 * con SELECT … FOR UPDATE para que un ajuste y una venta simultáneos se
 * serialicen en vez de pisarse: el que llegue segundo ve el valor ya aplicado.
 */
export async function setStock(
  tx: Prisma.TransactionClient,
  productId: string,
  branchId: string,
  quantity: number,
): Promise<StockMove> {
  await ensureRow(tx, productId, branchId)

  const locked = await tx.$queryRaw<Array<{ id: string; quantity: string; minStock: string }>>`
    SELECT "id", "quantity", "minStock" FROM "inventory"
    WHERE "productId" = ${productId} AND "branchId" = ${branchId}
    FOR UPDATE
  `
  const row = locked[0]
  const before = Number(row.quantity)

  await tx.inventory.update({
    where: { id: row.id },
    data: { quantity, lowStock: quantity <= Number(row.minStock) },
  })

  return { inventoryId: row.id, before, after: quantity }
}
