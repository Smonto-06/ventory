-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "notifyDailySummary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyEmail" TEXT,
ADD COLUMN     "notifyLowStock" BOOLEAN NOT NULL DEFAULT true;

