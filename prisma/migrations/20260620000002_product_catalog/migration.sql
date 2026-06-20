-- Add unitOfMeasure and supplier columns to products
ALTER TABLE "products"
  ADD COLUMN "unitOfMeasure" TEXT,
  ADD COLUMN "supplier" TEXT;
