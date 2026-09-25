-- AlterEnum
-- Tipos propios para la diferencia de un control de stock y para las dos patas
-- de un pasaje entre almacenes, que hasta ahora iban en la bolsa de ajuste_manual.

ALTER TYPE "TipoMovimientoStock" ADD VALUE IF NOT EXISTS 'diferencia_conteo';
ALTER TYPE "TipoMovimientoStock" ADD VALUE IF NOT EXISTS 'pasaje';
