-- AlterTable
ALTER TABLE "products" ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "variantLabel" TEXT,
ADD COLUMN     "variantOptions" JSONB;

-- CreateIndex
CREATE INDEX "products_businessId_parentId_idx" ON "products"("businessId", "parentId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

