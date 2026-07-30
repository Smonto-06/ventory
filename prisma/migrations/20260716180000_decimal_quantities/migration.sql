-- AlterTable
ALTER TABLE "inventory" ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "minStock" SET DEFAULT 0,
ALTER COLUMN "minStock" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "inventory_movements" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "quantityBefore" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "quantityAfter" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "purchase_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "sale_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "sale_return_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "sale_items" ALTER COLUMN "returnedQty" SET DEFAULT 0,
ALTER COLUMN "returnedQty" SET DATA TYPE DECIMAL(12,3);

