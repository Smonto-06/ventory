-- Los negocios registrados por /register no tenían sucursal (el registro no la
-- creaba), lo que impedía abrir caja y vender. Crea una sucursal "Principal"
-- para todo negocio que no tenga ninguna.
INSERT INTO "branches" ("id", "name", "businessId", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || b."id"), 'Principal', b."id", true, now(), now()
FROM "businesses" b
WHERE NOT EXISTS (SELECT 1 FROM "branches" br WHERE br."businessId" = b."id");
