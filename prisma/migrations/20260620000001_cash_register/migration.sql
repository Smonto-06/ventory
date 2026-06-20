-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('EXPENSE', 'WITHDRAWAL');

-- AlterTable: add new columns to cash_sessions
ALTER TABLE "cash_sessions"
  ADD COLUMN "terminal"      TEXT,
  ADD COLUMN "closingNotes"  TEXT,
  ADD COLUMN "closedById"    TEXT;

-- CreateIndex for openedById + status lookup
CREATE INDEX "cash_sessions_openedById_status_idx" ON "cash_sessions"("openedById", "status");

-- AddForeignKey for closedById
ALTER TABLE "cash_sessions"
  ADD CONSTRAINT "cash_sessions_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: cash_movements
CREATE TABLE "cash_movements" (
  "id"            TEXT NOT NULL,
  "type"          "CashMovementType" NOT NULL,
  "amount"        DECIMAL(12,2) NOT NULL,
  "description"   TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_movements_cashSessionId_idx" ON "cash_movements"("cashSessionId");

-- AddForeignKey: cash_movements -> cash_sessions
ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: cash_movements -> users
ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
