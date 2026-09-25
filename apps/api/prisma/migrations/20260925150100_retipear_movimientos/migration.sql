-- Re-tipeo del histórico de movimientos de stock.
-- Va en su propia migración porque usa valores de enum agregados en la anterior
-- (Postgres no permite usar un valor de enum recién creado en la misma transacción).

-- la corrección que aplica un control de stock
UPDATE "movimientos_stock" SET type = 'diferencia_conteo'
WHERE type = 'ajuste_manual' AND reference = 'control-stock';

-- las dos patas de un pasaje entre almacenes
UPDATE "movimientos_stock" SET type = 'pasaje'
WHERE type = 'ajuste_manual' AND (reference LIKE 'Pasaje a %' OR reference LIKE 'Pasaje desde %');
