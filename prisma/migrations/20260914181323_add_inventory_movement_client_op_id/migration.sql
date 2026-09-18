-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "clientOpId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_clientOpId_key" ON "inventory_movements"("clientOpId");

