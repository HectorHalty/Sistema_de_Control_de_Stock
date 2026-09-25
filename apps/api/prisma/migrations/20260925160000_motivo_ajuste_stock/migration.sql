-- CreateEnum
-- Motivo del ajuste manual: la merma conocida (rotura, vencido) no es la
-- diferencia de conteo, que es lo que se fue sin registrar.
CREATE TYPE "MotivoAjusteStock" AS ENUM ('rotura', 'vencido', 'correccion', 'entrada_directa');

-- AlterTable
-- Nullable y sin backfill: el histórico no tiene con qué distinguirse.
ALTER TABLE "movimientos_stock" ADD COLUMN "reason" "MotivoAjusteStock";
