-- Categorías y filtros del menú web
CREATE TABLE "categorias_web" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_web_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categorias_web_name_key" ON "categorias_web"("name");
CREATE UNIQUE INDEX "categorias_web_slug_key" ON "categorias_web"("slug");
CREATE INDEX "categorias_web_active_orden_idx" ON "categorias_web"("active", "orden");

CREATE TABLE "filtros_web" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filtros_web_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "filtros_web_slug_key" ON "filtros_web"("slug");
CREATE INDEX "filtros_web_active_orden_idx" ON "filtros_web"("active", "orden");

CREATE TABLE "productos_venta_filtros" (
    "producto_venta_id" TEXT NOT NULL,
    "filtro_web_id" TEXT NOT NULL,

    CONSTRAINT "productos_venta_filtros_pkey" PRIMARY KEY ("producto_venta_id","filtro_web_id")
);

ALTER TABLE "productos_venta" ADD COLUMN "categoria_web_id" TEXT;
ALTER TABLE "productos_venta" ADD COLUMN "orden_web" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "productos_venta" ADD COLUMN "popular_web" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "productos_venta_categoria_web_id_idx" ON "productos_venta"("categoria_web_id");

ALTER TABLE "productos_venta" ADD CONSTRAINT "productos_venta_categoria_web_id_fkey"
    FOREIGN KEY ("categoria_web_id") REFERENCES "categorias_web"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "productos_venta_filtros" ADD CONSTRAINT "productos_venta_filtros_producto_venta_id_fkey"
    FOREIGN KEY ("producto_venta_id") REFERENCES "productos_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "productos_venta_filtros" ADD CONSTRAINT "productos_venta_filtros_filtro_web_id_fkey"
    FOREIGN KEY ("filtro_web_id") REFERENCES "filtros_web"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sponsors: especificación de banner y medidas
ALTER TABLE "patrocinadores" ADD COLUMN "banner_label" TEXT;
ALTER TABLE "patrocinadores" ADD COLUMN "tipo_medio" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "patrocinadores" ADD COLUMN "ancho_px" INTEGER;
ALTER TABLE "patrocinadores" ADD COLUMN "alto_px" INTEGER;
ALTER TABLE "patrocinadores" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "patrocinadores_active_placement_orden_idx" ON "patrocinadores"("active", "placement", "orden");

-- Filtros por defecto
INSERT INTO "filtros_web" ("id", "slug", "label", "orden", "active", "updated_at") VALUES
    ('f1popular00000000000000000001', 'popular', 'Popular', 0, true, CURRENT_TIMESTAMP),
    ('f1econom00000000000000000002', 'economico', 'Económico', 1, true, CURRENT_TIMESTAMP),
    ('f1bebidas0000000000000000003', 'bebidas', 'Bebidas', 2, true, CURRENT_TIMESTAMP);
