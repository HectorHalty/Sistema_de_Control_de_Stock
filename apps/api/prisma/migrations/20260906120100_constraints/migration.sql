-- CHECK constraints que el lenguaje de Prisma no puede expresar.
-- Solo aditivo. No incluir DELETE, DROP ni UPDATE en este archivo.

-- Stock
ALTER TABLE "niveles_stock"
  ADD CONSTRAINT "niveles_stock_quantity_no_negativa" CHECK ("quantity" >= 0);
