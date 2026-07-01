-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "balance" DECIMAL(12,2) NOT NULL DEFAULT 0;
