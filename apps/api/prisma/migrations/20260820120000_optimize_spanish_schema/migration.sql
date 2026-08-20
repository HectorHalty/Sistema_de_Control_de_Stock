-- Optimize Spanish schema: rename tables, add FKs, indexes, uniqueness, ticket counter

-- ========== RENAME TABLES ==========
ALTER TABLE "User" RENAME TO "usuarios";
ALTER TABLE "Category" RENAME TO "categorias";
ALTER TABLE "Warehouse" RENAME TO "depositos";
ALTER TABLE "Product" RENAME TO "productos";
ALTER TABLE "StockLevel" RENAME TO "niveles_stock";
ALTER TABLE "Supplier" RENAME TO "proveedores";
ALTER TABLE "SupplierProduct" RENAME TO "proveedores_productos";
ALTER TABLE "SalesProduct" RENAME TO "productos_venta";
ALTER TABLE "SalesProductBundleItem" RENAME TO "items_combo_venta";
ALTER TABLE "RecipeItem" RENAME TO "items_receta";
ALTER TABLE "SalesTicket" RENAME TO "tickets_venta";
ALTER TABLE "SalesTicketItem" RENAME TO "items_ticket_venta";
ALTER TABLE "Kitchen" RENAME TO "cocinas";
ALTER TABLE "KitchenOrder" RENAME TO "ordenes_cocina";
ALTER TABLE "KitchenOrderItem" RENAME TO "items_orden_cocina";
ALTER TABLE "MediaItem" RENAME TO "medios";
ALTER TABLE "Sponsor" RENAME TO "patrocinadores";
ALTER TABLE "OnlineProduct" RENAME TO "productos_online";
ALTER TABLE "FootballTeam" RENAME TO "equipos_futbol";
ALTER TABLE "FootballMatch" RENAME TO "partidos_futbol";
ALTER TABLE "AuditEntry" RENAME TO "entradas_auditoria";
ALTER TABLE "StockMovement" RENAME TO "movimientos_stock";
ALTER TABLE "EmployeeConsumption" RENAME TO "consumos_empleado";
ALTER TABLE "StockCountSession" RENAME TO "sesiones_conteo";
ALTER TABLE "StockCountEntry" RENAME TO "entradas_conteo";
ALTER TABLE "PurchaseOrder" RENAME TO "ordenes_compra";
ALTER TABLE "PurchaseOrderItem" RENAME TO "items_orden_compra";
ALTER TABLE "ConsumptionLog" RENAME TO "logs_consumo";
ALTER TABLE "ConsumptionEntry" RENAME TO "entradas_consumo";

-- ========== TICKET COUNTER ==========
CREATE TABLE "contadores_ticket" (
    "id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 1000,
    CONSTRAINT "contadores_ticket_pkey" PRIMARY KEY ("id")
);

INSERT INTO "contadores_ticket" ("id", "valor")
SELECT 'default', COALESCE(MAX(number), 1000) FROM "tickets_venta";

CREATE TABLE "contadores_pedido" (
    "id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contadores_pedido_pkey" PRIMARY KEY ("id")
);

INSERT INTO "contadores_pedido" ("id", "valor")
SELECT 'default', COALESCE(MAX(
  CASE WHEN "orderNumber" ~ '^PED-[0-9]+$'
       THEN CAST(substring("orderNumber" from 5) AS INTEGER)
       ELSE 0 END
), 0) FROM "ordenes_compra";

-- ========== CLEAN ORPHANS BEFORE NEW FKs ==========
DELETE FROM "movimientos_stock" m
WHERE NOT EXISTS (SELECT 1 FROM "productos" p WHERE p.id = m."productId");

UPDATE "movimientos_stock" m
SET "warehouseId" = NULL
WHERE m."warehouseId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "depositos" d WHERE d.id = m."warehouseId");

DELETE FROM "consumos_empleado" c
WHERE NOT EXISTS (SELECT 1 FROM "productos" p WHERE p.id = c."productId")
   OR NOT EXISTS (SELECT 1 FROM "depositos" d WHERE d.id = c."warehouseId");

DELETE FROM "entradas_conteo" e
WHERE NOT EXISTS (SELECT 1 FROM "productos" p WHERE p.id = e."productId");

UPDATE "productos_online" o
SET "stockProductId" = NULL
WHERE o."stockProductId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "productos" p WHERE p.id = o."stockProductId");

DELETE FROM "items_orden_cocina" i
WHERE NOT EXISTS (SELECT 1 FROM "productos_venta" pv WHERE pv.id = i."salesProductId");

-- Deduplicate productos_venta (name, kitchenId) keeping oldest
DELETE FROM "productos_venta" pv
WHERE pv.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY name, "kitchenId" ORDER BY "createdAt" ASC) AS rn
    FROM "productos_venta"
  ) t WHERE t.rn > 1
);

-- Deduplicate entradas_conteo (sessionId, productId)
DELETE FROM "entradas_conteo" e
WHERE e.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "sessionId", "productId" ORDER BY "createdAt" ASC) AS rn
    FROM "entradas_conteo"
  ) t WHERE t.rn > 1
);

-- Deduplicate items_orden_compra (purchaseOrderId, productId)
DELETE FROM "items_orden_compra" i
WHERE i.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "purchaseOrderId", "productId" ORDER BY id ASC) AS rn
    FROM "items_orden_compra"
  ) t WHERE t.rn > 1
);

-- ========== NEW FOREIGN KEYS ==========
ALTER TABLE "movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos_stock"
  ADD CONSTRAINT "movimientos_stock_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "consumos_empleado"
  ADD CONSTRAINT "consumos_empleado_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consumos_empleado"
  ADD CONSTRAINT "consumos_empleado_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entradas_conteo"
  ADD CONSTRAINT "entradas_conteo_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "productos_online"
  ADD CONSTRAINT "productos_online_stockProductId_fkey"
  FOREIGN KEY ("stockProductId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items_orden_cocina"
  ADD CONSTRAINT "items_orden_cocina_salesProductId_fkey"
  FOREIGN KEY ("salesProductId") REFERENCES "productos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ========== UNIQUE CONSTRAINTS (anti-duplicados) ==========
CREATE UNIQUE INDEX "productos_venta_name_kitchenId_key" ON "productos_venta"("name", "kitchenId");
CREATE UNIQUE INDEX "entradas_conteo_sessionId_productId_key" ON "entradas_conteo"("sessionId", "productId");
CREATE UNIQUE INDEX "items_orden_compra_purchaseOrderId_productId_key" ON "items_orden_compra"("purchaseOrderId", "productId");

-- ========== PERFORMANCE INDEXES ==========
CREATE INDEX "productos_name_idx" ON "productos"("name");
CREATE INDEX "productos_venta_kitchenId_idx" ON "productos_venta"("kitchenId");
CREATE INDEX "productos_venta_active_kitchenId_idx" ON "productos_venta"("active", "kitchenId");
CREATE INDEX "productos_venta_active_name_idx" ON "productos_venta"("active", "name");
CREATE INDEX "proveedores_productos_productId_idx" ON "proveedores_productos"("productId");
CREATE INDEX "tickets_venta_createdAt_idx" ON "tickets_venta"("createdAt");
CREATE INDEX "tickets_venta_status_createdAt_idx" ON "tickets_venta"("status", "createdAt");
CREATE INDEX "cocinas_active_idx" ON "cocinas"("active");
CREATE INDEX "ordenes_cocina_kitchenId_status_createdAt_idx" ON "ordenes_cocina"("kitchenId", "status", "createdAt");
CREATE INDEX "items_orden_cocina_salesProductId_idx" ON "items_orden_cocina"("salesProductId");
CREATE INDEX "productos_online_stockProductId_idx" ON "productos_online"("stockProductId");
CREATE INDEX "partidos_futbol_status_date_idx" ON "partidos_futbol"("status", "date");
CREATE INDEX "entradas_auditoria_userId_createdAt_idx" ON "entradas_auditoria"("userId", "createdAt");
CREATE INDEX "movimientos_stock_productId_createdAt_idx" ON "movimientos_stock"("productId", "createdAt");
CREATE INDEX "movimientos_stock_type_createdAt_idx" ON "movimientos_stock"("type", "createdAt");
CREATE INDEX "movimientos_stock_reference_idx" ON "movimientos_stock"("reference");
CREATE INDEX "consumos_empleado_warehouseId_idx" ON "consumos_empleado"("warehouseId");
CREATE INDEX "consumos_empleado_day_productId_idx" ON "consumos_empleado"("day", "productId");
CREATE INDEX "ordenes_compra_status_createdAt_idx" ON "ordenes_compra"("status", "createdAt");
CREATE INDEX "logs_consumo_day_dateType_idx" ON "logs_consumo"("day", "dateType");
