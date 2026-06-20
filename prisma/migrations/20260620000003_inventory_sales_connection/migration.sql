-- VEN-9: Connect inventory with sales
-- Adds allowNegativeStock config to Business and lowStock flag to Inventory

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inventory"
  ADD COLUMN IF NOT EXISTS "lowStock" BOOLEAN NOT NULL DEFAULT false;

-- Initialize lowStock based on current stock levels
UPDATE "inventory" SET "lowStock" = ("quantity" <= "minStock");
