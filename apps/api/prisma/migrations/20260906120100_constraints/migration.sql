-- CHECK constraints que el lenguaje de Prisma no puede expresar.
-- Solo aditivo. No incluir DELETE, DROP ni UPDATE en este archivo.

-- Stock
ALTER TABLE "niveles_stock"
  ADD CONSTRAINT "niveles_stock_quantity_no_negativa" CHECK ("quantity" >= 0);

-- Ventas
ALTER TABLE "productos_venta"
  ADD CONSTRAINT "productos_venta_price_no_negativo" CHECK ("price" >= 0);

ALTER TABLE "tickets_venta"
  ADD CONSTRAINT "tickets_venta_total_no_negativo" CHECK ("total" >= 0);

ALTER TABLE "items_ticket_venta"
  ADD CONSTRAINT "items_ticket_venta_unitPrice_no_negativo" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "items_ticket_venta_quantity_positiva" CHECK ("quantity" > 0);

ALTER TABLE "items_combo_venta"
  ADD CONSTRAINT "items_combo_venta_quantity_positiva" CHECK ("quantity" > 0);
