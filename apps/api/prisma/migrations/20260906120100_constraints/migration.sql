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

-- Cantina online
ALTER TABLE "pedidos_publicos"
  ADD CONSTRAINT "pedidos_publicos_total_no_negativo" CHECK ("total" >= 0);

ALTER TABLE "items_pedido_publico"
  ADD CONSTRAINT "items_pedido_publico_unitPrice_no_negativo" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "items_pedido_publico_quantity_positiva" CHECK ("quantity" > 0);

-- Fútbol
ALTER TABLE "partidos_futbol"
  ADD CONSTRAINT "partidos_futbol_homeGoals_no_negativos"
    CHECK ("homeGoals" IS NULL OR "homeGoals" >= 0),
  ADD CONSTRAINT "partidos_futbol_awayGoals_no_negativos"
    CHECK ("awayGoals" IS NULL OR "awayGoals" >= 0);

ALTER TABLE "cuentas_publicas"
  ADD CONSTRAINT "cuentas_publicas_con_metodo_de_auth"
    CHECK ("googleId" IS NOT NULL OR "password_hash" IS NOT NULL);
