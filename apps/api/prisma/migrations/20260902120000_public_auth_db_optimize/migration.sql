-- CuentaPublica: auth email/password + google opcional
ALTER TABLE "cuentas_publicas" ALTER COLUMN "googleId" DROP NOT NULL;
ALTER TABLE "cuentas_publicas" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "cuentas_publicas" ADD COLUMN IF NOT EXISTS "nombre" TEXT;
CREATE INDEX IF NOT EXISTS "cuentas_publicas_dniConfirmado_idx" ON "cuentas_publicas"("dniConfirmado");

-- ItemPedidoPublico: FK a productos de venta
CREATE INDEX IF NOT EXISTS "items_pedido_publico_salesProductId_idx" ON "items_pedido_publico"("salesProductId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_pedido_publico_salesProductId_fkey'
  ) THEN
    ALTER TABLE "items_pedido_publico"
      ADD CONSTRAINT "items_pedido_publico_salesProductId_fkey"
      FOREIGN KEY ("salesProductId") REFERENCES "productos_venta"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PedidoPublico: índices compuestos para listados y métricas
CREATE INDEX IF NOT EXISTS "pedidos_publicos_cuentaPublicaId_createdAt_idx"
  ON "pedidos_publicos"("cuentaPublicaId", "createdAt");
CREATE INDEX IF NOT EXISTS "pedidos_publicos_status_createdAt_idx"
  ON "pedidos_publicos"("status", "createdAt");

-- TokenRetiroQR: token ya es UNIQUE, quitar índice redundante si existe
DROP INDEX IF EXISTS "tokens_retiro_qr_token_idx";

-- Suspension: FK a torneo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suspensiones_torneoId_fkey'
  ) THEN
    ALTER TABLE "suspensiones"
      ADD CONSTRAINT "suspensiones_torneoId_fkey"
      FOREIGN KEY ("torneoId") REFERENCES "torneos"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
