-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "saleSeq" INTEGER NOT NULL DEFAULT 0;


-- Arranca el consecutivo donde va cada sucursal para no repetir folios existentes
UPDATE "branches" b
SET "saleSeq" = (SELECT COUNT(*) FROM "sales" s WHERE s."branchId" = b."id");
