-- AlterTable
ALTER TABLE "entradas_auditoria" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "entradas_auditoria" ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE "entradas_auditoria" ADD COLUMN IF NOT EXISTS "module" TEXT;
CREATE INDEX IF NOT EXISTS "entradas_auditoria_module_createdAt_idx" ON "entradas_auditoria"("module", "createdAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "configuraciones" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "configuraciones_key_key" ON "configuraciones"("key");
CREATE INDEX IF NOT EXISTS "configuraciones_scope_idx" ON "configuraciones"("scope");

CREATE TABLE IF NOT EXISTS "categorias_venta" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🍽️',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_venta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "categorias_venta_name_key" ON "categorias_venta"("name");

CREATE TABLE IF NOT EXISTS "impresoras" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 9100,
    "paperWidth" INTEGER NOT NULL DEFAULT 80,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impresoras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "mesas_venta" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'libre',
    "currentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_venta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cuentas_equipo" (
    "id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'abierta',
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_equipo_pkey" PRIMARY KEY ("id")
);
