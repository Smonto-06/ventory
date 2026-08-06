-- CreateEnum
CREATE TYPE "plan_payment_status" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "paidUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "plan_payments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" "plan_payment_status" NOT NULL DEFAULT 'PENDING',
    "wompiId" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_payments_reference_key" ON "plan_payments"("reference");

-- CreateIndex
CREATE INDEX "plan_payments_businessId_createdAt_idx" ON "plan_payments"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "plan_payments" ADD CONSTRAINT "plan_payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

