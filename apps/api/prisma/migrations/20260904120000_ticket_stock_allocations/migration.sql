-- Snapshot de descuento de stock por almacén en tickets e ítems (devoluciones invertibles).
ALTER TABLE "tickets_venta" ADD COLUMN IF NOT EXISTS "stockAllocations" JSONB;
ALTER TABLE "items_ticket_venta" ADD COLUMN IF NOT EXISTS "stockAllocations" JSONB;
