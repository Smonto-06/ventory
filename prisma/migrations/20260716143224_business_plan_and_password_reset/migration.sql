-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");

