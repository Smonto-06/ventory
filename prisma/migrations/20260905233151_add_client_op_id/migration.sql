-- AlterTable
ALTER TABLE "products" ADD COLUMN     "clientOpId" TEXT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "clientOpId" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "clientOpId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_clientOpId_key" ON "products"("clientOpId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_clientOpId_key" ON "purchases"("clientOpId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_clientOpId_key" ON "sales"("clientOpId");

