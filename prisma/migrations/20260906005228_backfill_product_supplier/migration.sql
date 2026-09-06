-- Vincula Product.supplierId a partir del texto libre legado (Product.supplier)
-- para los productos que ya existían antes de que POST/PATCH /api/products y
-- el importador CSV empezaran a resolver ese enlace (este PR). Sin este
-- backfill, esos productos viejos seguían sin supplierId y /api/suppliers
-- reportaba 0 (o un conteo incompleto) de productos para proveedores que en
-- realidad sí los tenían asociados por el campo de texto libre.
--
-- Mismo criterio de resolución que resolveOrCreateSupplier() (lib/api-helpers.ts):
-- coincidencia insensible a mayúsculas por (businessId, nombre recortado).
-- Idempotente: una segunda corrida no encuentra ya productos con supplierId
-- NULL que aplicar, así que no crea duplicados ni vuelve a tocar nada.

-- 1) Crea el Supplier que falte para cada (negocio, nombre) usado en el campo
--    de texto libre de un producto sin supplierId, cuando no exista ya uno con
--    ese nombre (sin distinguir mayúsculas) para ese negocio.
INSERT INTO "suppliers" ("id", "businessId", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), t."businessId", t."name", true, now(), now()
FROM (
  SELECT DISTINCT p."businessId" AS "businessId", trim(p."supplier") AS "name"
  FROM "products" p
  WHERE p."supplierId" IS NULL
    AND p."supplier" IS NOT NULL
    AND trim(p."supplier") <> ''
) t
WHERE NOT EXISTS (
  SELECT 1 FROM "suppliers" s
  WHERE s."businessId" = t."businessId" AND lower(s."name") = lower(t."name")
);

-- 2) Enlaza cada producto con ese Supplier (recién creado o ya existente).
UPDATE "products" p
SET "supplierId" = s."id"
FROM "suppliers" s
WHERE p."supplierId" IS NULL
  AND p."supplier" IS NOT NULL
  AND trim(p."supplier") <> ''
  AND s."businessId" = p."businessId"
  AND lower(s."name") = lower(trim(p."supplier"));
