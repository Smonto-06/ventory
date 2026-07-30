-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "verifyToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_verifyToken_key" ON "users"("verifyToken");


-- Usuarios existentes: quedan verificados para no bloquear cuentas en uso
UPDATE "users" SET "emailVerified" = now() WHERE "emailVerified" IS NULL;
