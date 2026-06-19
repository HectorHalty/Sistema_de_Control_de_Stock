-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Operador',
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidades',
    "orderUnit" INTEGER,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Comidas',
    "kitchenId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "emoji" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'simple',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesProductBundleItem" (
    "id" TEXT NOT NULL,
    "promoProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesProductBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "salesProductId" TEXT NOT NULL,
    "stockProductId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTicket" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'emitido',
    "total" DECIMAL(10,2) NOT NULL,
    "operatorId" TEXT NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "SalesTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTicketItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "salesProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesTicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kitchen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kitchen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenOrder" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "operatorName" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenOrderItem" (
    "id" TEXT NOT NULL,
    "kitchenOrderId" TEXT NOT NULL,
    "salesProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'lch-media',
    "key" TEXT NOT NULL,
    "matchDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'banner',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "image" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "attributes" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stockProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootballTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootballMatch" (
    "id" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "venue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reference" TEXT,
    "operatorId" TEXT,
    "operatorName" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeConsumption" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT,
    "warehouseId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidades',
    "previousStock" DECIMAL(12,3) NOT NULL,
    "newStock" DECIMAL(12,3) NOT NULL,
    "operatorId" TEXT,
    "operatorName" TEXT,
    "operatorRole" TEXT,
    "note" TEXT,

    CONSTRAINT "EmployeeConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "dateType" TEXT NOT NULL DEFAULT 'regular',
    "operatorId" TEXT,
    "operatorName" TEXT,

    CONSTRAINT "StockCountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pendiente',
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOrdered" DECIMAL(12,3) NOT NULL,
    "quantityReceived" DECIMAL(12,3),

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidades',
    "expected" DECIMAL(12,3) NOT NULL,
    "counted" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionLog" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "dateType" TEXT NOT NULL DEFAULT 'regular',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumptionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionEntry" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "previousStock" DECIMAL(12,3) NOT NULL,
    "newStock" DECIMAL(12,3) NOT NULL,
    "consumed" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidades',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumptionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "StockLevel_productId_idx" ON "StockLevel"("productId");

-- CreateIndex
CREATE INDEX "StockLevel_warehouseId_idx" ON "StockLevel"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_productId_warehouseId_key" ON "StockLevel"("productId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_supplierId_productId_key" ON "SupplierProduct"("supplierId", "productId");

-- CreateIndex
CREATE INDEX "SalesProductBundleItem_promoProductId_idx" ON "SalesProductBundleItem"("promoProductId");

-- CreateIndex
CREATE INDEX "SalesProductBundleItem_componentProductId_idx" ON "SalesProductBundleItem"("componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesProductBundleItem_promoProductId_componentProductId_key" ON "SalesProductBundleItem"("promoProductId", "componentProductId");

-- CreateIndex
CREATE INDEX "RecipeItem_salesProductId_idx" ON "RecipeItem"("salesProductId");

-- CreateIndex
CREATE INDEX "RecipeItem_stockProductId_idx" ON "RecipeItem"("stockProductId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_salesProductId_stockProductId_key" ON "RecipeItem"("salesProductId", "stockProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTicket_number_key" ON "SalesTicket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTicket_idempotencyKey_key" ON "SalesTicket"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SalesTicket_operatorId_idx" ON "SalesTicket"("operatorId");

-- CreateIndex
CREATE INDEX "SalesTicket_status_idx" ON "SalesTicket"("status");

-- CreateIndex
CREATE INDEX "SalesTicketItem_ticketId_idx" ON "SalesTicketItem"("ticketId");

-- CreateIndex
CREATE INDEX "SalesTicketItem_salesProductId_idx" ON "SalesTicketItem"("salesProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Kitchen_name_key" ON "Kitchen"("name");

-- CreateIndex
CREATE INDEX "KitchenOrder_ticketId_idx" ON "KitchenOrder"("ticketId");

-- CreateIndex
CREATE INDEX "KitchenOrder_kitchenId_idx" ON "KitchenOrder"("kitchenId");

-- CreateIndex
CREATE INDEX "KitchenOrder_status_idx" ON "KitchenOrder"("status");

-- CreateIndex
CREATE INDEX "KitchenOrderItem_kitchenOrderId_idx" ON "KitchenOrderItem"("kitchenOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_key_key" ON "MediaItem"("key");

-- CreateIndex
CREATE INDEX "MediaItem_type_idx" ON "MediaItem"("type");

-- CreateIndex
CREATE INDEX "MediaItem_matchDate_idx" ON "MediaItem"("matchDate");

-- CreateIndex
CREATE INDEX "Sponsor_active_idx" ON "Sponsor"("active");

-- CreateIndex
CREATE INDEX "Sponsor_placement_idx" ON "Sponsor"("placement");

-- CreateIndex
CREATE INDEX "OnlineProduct_active_idx" ON "OnlineProduct"("active");

-- CreateIndex
CREATE INDEX "OnlineProduct_category_idx" ON "OnlineProduct"("category");

-- CreateIndex
CREATE UNIQUE INDEX "FootballTeam_name_key" ON "FootballTeam"("name");

-- CreateIndex
CREATE INDEX "FootballMatch_status_idx" ON "FootballMatch"("status");

-- CreateIndex
CREATE INDEX "FootballMatch_date_idx" ON "FootballMatch"("date");

-- CreateIndex
CREATE INDEX "AuditEntry_userId_idx" ON "AuditEntry"("userId");

-- CreateIndex
CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "EmployeeConsumption_productId_idx" ON "EmployeeConsumption"("productId");

-- CreateIndex
CREATE INDEX "EmployeeConsumption_day_idx" ON "EmployeeConsumption"("day");

-- CreateIndex
CREATE INDEX "EmployeeConsumption_createdAt_idx" ON "EmployeeConsumption"("createdAt");

-- CreateIndex
CREATE INDEX "StockCountSession_date_idx" ON "StockCountSession"("date");

-- CreateIndex
CREATE INDEX "StockCountSession_createdAt_idx" ON "StockCountSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_date_idx" ON "PurchaseOrder"("date");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE INDEX "StockCountEntry_sessionId_idx" ON "StockCountEntry"("sessionId");

-- CreateIndex
CREATE INDEX "StockCountEntry_productId_idx" ON "StockCountEntry"("productId");

-- CreateIndex
CREATE INDEX "ConsumptionLog_day_idx" ON "ConsumptionLog"("day");

-- CreateIndex
CREATE INDEX "ConsumptionLog_dateType_idx" ON "ConsumptionLog"("dateType");

-- CreateIndex
CREATE INDEX "ConsumptionEntry_logId_idx" ON "ConsumptionEntry"("logId");

-- CreateIndex
CREATE INDEX "ConsumptionEntry_productId_idx" ON "ConsumptionEntry"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesProduct" ADD CONSTRAINT "SalesProduct_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesProductBundleItem" ADD CONSTRAINT "SalesProductBundleItem_promoProductId_fkey" FOREIGN KEY ("promoProductId") REFERENCES "SalesProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesProductBundleItem" ADD CONSTRAINT "SalesProductBundleItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "SalesProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_salesProductId_fkey" FOREIGN KEY ("salesProductId") REFERENCES "SalesProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_stockProductId_fkey" FOREIGN KEY ("stockProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTicket" ADD CONSTRAINT "SalesTicket_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTicketItem" ADD CONSTRAINT "SalesTicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SalesTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTicketItem" ADD CONSTRAINT "SalesTicketItem_salesProductId_fkey" FOREIGN KEY ("salesProductId") REFERENCES "SalesProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SalesTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrderItem" ADD CONSTRAINT "KitchenOrderItem_kitchenOrderId_fkey" FOREIGN KEY ("kitchenOrderId") REFERENCES "KitchenOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballMatch" ADD CONSTRAINT "FootballMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "FootballTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballMatch" ADD CONSTRAINT "FootballMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "FootballTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountEntry" ADD CONSTRAINT "StockCountEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StockCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionEntry" ADD CONSTRAINT "ConsumptionEntry_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ConsumptionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
