-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('unidades', 'kg', 'litros', 'cajas');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('venta', 'devolucion', 'venta_anulada', 'ajuste_manual', 'consumo', 'entrada');

-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('Pendiente', 'Recibido');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Operador',
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depositos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depositos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "unit" "UnidadMedida" NOT NULL DEFAULT 'unidades',
    "orderUnit" INTEGER,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveles_stock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "niveles_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores_productos" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "productos_venta_filtros" (
    "producto_venta_id" TEXT NOT NULL,
    "filtro_web_id" TEXT NOT NULL,

    CONSTRAINT "productos_venta_filtros_pkey" PRIMARY KEY ("producto_venta_id","filtro_web_id")
);

-- CreateTable
CREATE TABLE "productos_venta" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Comidas',
    "kitchenId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "emoji" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'simple',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "visibleWeb" BOOLEAN NOT NULL DEFAULT false,
    "descripcionWeb" TEXT,
    "imagenWeb" TEXT,
    "categoria_web_id" TEXT,
    "orden_web" INTEGER NOT NULL DEFAULT 0,
    "popular_web" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_combo_venta" (
    "id" TEXT NOT NULL,
    "promoProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_combo_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_receta" (
    "id" TEXT NOT NULL,
    "salesProductId" TEXT NOT NULL,
    "stockProductId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets_venta" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'emitido',
    "total" DECIMAL(10,2) NOT NULL,
    "operatorId" TEXT NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'pos',
    "stockAllocations" JSONB,

    CONSTRAINT "tickets_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_ticket_venta" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "salesProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockAllocations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_ticket_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contadores_ticket" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "valor" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "contadores_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contadores_pedido" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contadores_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cocinas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cocinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_cocina" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "operatorName" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT,
    "pedidoPublicoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_cocina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_orden_cocina" (
    "id" TEXT NOT NULL,
    "kitchenOrderId" TEXT NOT NULL,
    "salesProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_orden_cocina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medios" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'lch-media',
    "key" TEXT NOT NULL,
    "matchDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrocinadores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'banner',
    "banner_label" TEXT,
    "tipo_medio" TEXT NOT NULL DEFAULT 'image',
    "ancho_px" INTEGER,
    "alto_px" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrocinadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_online" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "image" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "attributes" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stockProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_online_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temporadas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campeonatos" (
    "id" TEXT NOT NULL,
    "temporadaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campeonatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_config" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "maxPlantel" INTEGER NOT NULL,
    "maxIncorporaciones" INTEGER NOT NULL DEFAULT 3,
    "minJugadoresInicio" INTEGER NOT NULL,
    "grupoCanchasId" TEXT,
    "colorHex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneos" (
    "id" TEXT NOT NULL,
    "campeonatoId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "torneos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneos_config" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "puntosVictoria" INTEGER NOT NULL DEFAULT 3,
    "puntosEmpate" INTEGER NOT NULL DEFAULT 1,
    "puntosDerrota" INTEGER NOT NULL DEFAULT 0,
    "resultadoWO" TEXT NOT NULL DEFAULT '3-0',
    "descuentoPuntosWOSinAviso" INTEGER NOT NULL DEFAULT 6,
    "descuentoPuntosWOConAviso" INTEGER NOT NULL DEFAULT 3,
    "criteriosDesempate" JSONB NOT NULL DEFAULT '["difGoles","golesContra","enfrentamientoDirecto","fairPlay","expulsados","sorteo"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "torneos_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos_futbol" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "logo" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_futbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos_inscripcion" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "abbr" TEXT,
    "color" TEXT,
    "descuentoPuntosWO" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT,
    "telefonoCelular" TEXT,
    "telefonoParticular" TEXT,
    "telefonoLaboral" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_publicas" (
    "id" TEXT NOT NULL,
    "googleId" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "nombre" TEXT,
    "avatarUrl" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'usuario',
    "personaId" TEXT,
    "equipoSeguidoId" TEXT,
    "dniConfirmado" TEXT,
    "notifPartidos" BOOLEAN NOT NULL DEFAULT true,
    "notifPedidos" BOOLEAN NOT NULL DEFAULT true,
    "notifTorneo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_publicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capitanes_autorizados" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "equipoInscripcionId" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaPublicaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capitanes_autorizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones_jugador" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "equipoInscripcionId" TEXT NOT NULL,
    "numeroCamiseta" INTEGER,
    "rolPlantel" TEXT NOT NULL DEFAULT 'jugador',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscripciones_jugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_canchas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_canchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canchas" (
    "id" TEXT NOT NULL,
    "grupoCanchasId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franjas_horarias" (
    "id" TEXT NOT NULL,
    "grupoCanchasId" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "duracionMinutos" INTEGER NOT NULL DEFAULT 90,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franjas_horarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jornadas" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "suspendida" BOOLEAN NOT NULL DEFAULT false,
    "esRecuperacion" BOOLEAN NOT NULL DEFAULT false,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jornadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferencias_horario" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "jornadaId" TEXT NOT NULL,
    "equipoInscripcionId" TEXT NOT NULL,
    "horaPreferida" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preferencias_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidos_futbol" (
    "id" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "venue" TEXT,
    "torneoId" TEXT,
    "jornadaId" TEXT,
    "homeInscripcionId" TEXT,
    "awayInscripcionId" TEXT,
    "canchaId" TEXT,
    "horaInicio" TEXT,
    "bloqueadoManual" BOOLEAN NOT NULL DEFAULT false,
    "equipoLibreId" TEXT,
    "esWO" BOOLEAN NOT NULL DEFAULT false,
    "motivoWO" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partidos_futbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_partido" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "minuto" INTEGER,
    "articuloRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_partido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspensiones" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "torneoId" TEXT,
    "motivo" TEXT NOT NULL,
    "fechasRestantes" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "origenPartidoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suspensiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglamento_apartados" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglamento_apartados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglamento_articulos" (
    "id" TEXT NOT NULL,
    "apartadoId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT,
    "contenido" TEXT NOT NULL,
    "aplicable" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglamento_articulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglamento_anexos" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglamento_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglamento_reglas" (
    "id" TEXT NOT NULL,
    "anexoId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "titulo" TEXT,
    "contenido" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglamento_reglas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_publicos" (
    "id" TEXT NOT NULL,
    "cuentaPublicaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente_pago',
    "total" DECIMAL(10,2) NOT NULL,
    "ticketVentaId" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_publicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_pedido_publico" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "salesProductId" TEXT,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pedido_publico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_retiro_qr" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "invalido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_retiro_qr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entradas_auditoria" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "module" TEXT,
    "action" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entradas_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TipoMovimientoStock" NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reference" TEXT,
    "operatorId" TEXT,
    "operatorName" TEXT,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumos_empleado" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT,
    "warehouseId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "UnidadMedida" NOT NULL DEFAULT 'unidades',
    "previousStock" DECIMAL(12,3) NOT NULL,
    "newStock" DECIMAL(12,3) NOT NULL,
    "operatorId" TEXT,
    "operatorName" TEXT,
    "operatorRole" TEXT,
    "note" TEXT,

    CONSTRAINT "consumos_empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_conteo" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "dateType" TEXT NOT NULL DEFAULT 'regular',
    "operatorId" TEXT,
    "operatorName" TEXT,

    CONSTRAINT "sesiones_conteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entradas_conteo" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unit" "UnidadMedida" NOT NULL DEFAULT 'unidades',
    "expected" DECIMAL(12,3) NOT NULL,
    "counted" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entradas_conteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" "EstadoOrdenCompra" NOT NULL DEFAULT 'Pendiente',
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_orden_compra" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOrdered" DECIMAL(12,3) NOT NULL,
    "quantityReceived" DECIMAL(12,3),

    CONSTRAINT "items_orden_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuraciones" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_venta" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🍽️',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impresoras" (
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

-- CreateTable
CREATE TABLE "mesas_venta" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'libre',
    "currentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_equipo" (
    "id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'abierta',
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_name_key" ON "categorias"("name");

-- CreateIndex
CREATE UNIQUE INDEX "depositos_name_key" ON "depositos"("name");

-- CreateIndex
CREATE UNIQUE INDEX "productos_code_key" ON "productos"("code");

-- CreateIndex
CREATE INDEX "productos_categoryId_idx" ON "productos"("categoryId");

-- CreateIndex
CREATE INDEX "productos_name_idx" ON "productos"("name");

-- CreateIndex
CREATE INDEX "niveles_stock_productId_idx" ON "niveles_stock"("productId");

-- CreateIndex
CREATE INDEX "niveles_stock_warehouseId_idx" ON "niveles_stock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_stock_productId_warehouseId_key" ON "niveles_stock"("productId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_name_key" ON "proveedores"("name");

-- CreateIndex
CREATE INDEX "proveedores_productos_productId_idx" ON "proveedores_productos"("productId");

-- CreateIndex
CREATE INDEX "proveedores_productos_supplierId_idx" ON "proveedores_productos"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_productos_supplierId_productId_key" ON "proveedores_productos"("supplierId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_web_name_key" ON "categorias_web"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_web_slug_key" ON "categorias_web"("slug");

-- CreateIndex
CREATE INDEX "categorias_web_active_orden_idx" ON "categorias_web"("active", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "filtros_web_slug_key" ON "filtros_web"("slug");

-- CreateIndex
CREATE INDEX "filtros_web_active_orden_idx" ON "filtros_web"("active", "orden");

-- CreateIndex
CREATE INDEX "productos_venta_kitchenId_idx" ON "productos_venta"("kitchenId");

-- CreateIndex
CREATE INDEX "productos_venta_active_kitchenId_idx" ON "productos_venta"("active", "kitchenId");

-- CreateIndex
CREATE INDEX "productos_venta_active_name_idx" ON "productos_venta"("active", "name");

-- CreateIndex
CREATE INDEX "productos_venta_visibleWeb_active_idx" ON "productos_venta"("visibleWeb", "active");

-- CreateIndex
CREATE INDEX "productos_venta_categoria_web_id_idx" ON "productos_venta"("categoria_web_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_venta_name_kitchenId_key" ON "productos_venta"("name", "kitchenId");

-- CreateIndex
CREATE INDEX "items_combo_venta_promoProductId_idx" ON "items_combo_venta"("promoProductId");

-- CreateIndex
CREATE INDEX "items_combo_venta_componentProductId_idx" ON "items_combo_venta"("componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "items_combo_venta_promoProductId_componentProductId_key" ON "items_combo_venta"("promoProductId", "componentProductId");

-- CreateIndex
CREATE INDEX "items_receta_salesProductId_idx" ON "items_receta"("salesProductId");

-- CreateIndex
CREATE INDEX "items_receta_stockProductId_idx" ON "items_receta"("stockProductId");

-- CreateIndex
CREATE UNIQUE INDEX "items_receta_salesProductId_stockProductId_key" ON "items_receta"("salesProductId", "stockProductId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_venta_number_key" ON "tickets_venta"("number");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_venta_idempotencyKey_key" ON "tickets_venta"("idempotencyKey");

-- CreateIndex
CREATE INDEX "tickets_venta_operatorId_idx" ON "tickets_venta"("operatorId");

-- CreateIndex
CREATE INDEX "tickets_venta_status_idx" ON "tickets_venta"("status");

-- CreateIndex
CREATE INDEX "tickets_venta_createdAt_idx" ON "tickets_venta"("createdAt");

-- CreateIndex
CREATE INDEX "tickets_venta_status_createdAt_idx" ON "tickets_venta"("status", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_venta_origen_idx" ON "tickets_venta"("origen");

-- CreateIndex
CREATE INDEX "items_ticket_venta_ticketId_idx" ON "items_ticket_venta"("ticketId");

-- CreateIndex
CREATE INDEX "items_ticket_venta_salesProductId_idx" ON "items_ticket_venta"("salesProductId");

-- CreateIndex
CREATE UNIQUE INDEX "cocinas_name_key" ON "cocinas"("name");

-- CreateIndex
CREATE INDEX "cocinas_active_idx" ON "cocinas"("active");

-- CreateIndex
CREATE INDEX "ordenes_cocina_ticketId_idx" ON "ordenes_cocina"("ticketId");

-- CreateIndex
CREATE INDEX "ordenes_cocina_kitchenId_idx" ON "ordenes_cocina"("kitchenId");

-- CreateIndex
CREATE INDEX "ordenes_cocina_status_idx" ON "ordenes_cocina"("status");

-- CreateIndex
CREATE INDEX "ordenes_cocina_pedidoPublicoId_idx" ON "ordenes_cocina"("pedidoPublicoId");

-- CreateIndex
CREATE INDEX "ordenes_cocina_kitchenId_status_createdAt_idx" ON "ordenes_cocina"("kitchenId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "items_orden_cocina_kitchenOrderId_idx" ON "items_orden_cocina"("kitchenOrderId");

-- CreateIndex
CREATE INDEX "items_orden_cocina_salesProductId_idx" ON "items_orden_cocina"("salesProductId");

-- CreateIndex
CREATE UNIQUE INDEX "medios_key_key" ON "medios"("key");

-- CreateIndex
CREATE INDEX "medios_type_idx" ON "medios"("type");

-- CreateIndex
CREATE INDEX "medios_matchDate_idx" ON "medios"("matchDate");

-- CreateIndex
CREATE INDEX "patrocinadores_active_idx" ON "patrocinadores"("active");

-- CreateIndex
CREATE INDEX "patrocinadores_placement_idx" ON "patrocinadores"("placement");

-- CreateIndex
CREATE INDEX "patrocinadores_active_placement_orden_idx" ON "patrocinadores"("active", "placement", "orden");

-- CreateIndex
CREATE INDEX "productos_online_active_idx" ON "productos_online"("active");

-- CreateIndex
CREATE INDEX "productos_online_category_idx" ON "productos_online"("category");

-- CreateIndex
CREATE INDEX "productos_online_stockProductId_idx" ON "productos_online"("stockProductId");

-- CreateIndex
CREATE INDEX "temporadas_activa_idx" ON "temporadas"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "temporadas_anio_key" ON "temporadas"("anio");

-- CreateIndex
CREATE INDEX "campeonatos_activo_idx" ON "campeonatos"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "campeonatos_temporadaId_nombre_key" ON "campeonatos"("temporadaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_config_codigo_key" ON "categorias_config"("codigo");

-- CreateIndex
CREATE INDEX "torneos_activo_publicado_idx" ON "torneos"("activo", "publicado");

-- CreateIndex
CREATE UNIQUE INDEX "torneos_campeonatoId_categoriaId_key" ON "torneos"("campeonatoId", "categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "torneos_config_torneoId_key" ON "torneos_config"("torneoId");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_futbol_name_key" ON "equipos_futbol"("name");

-- CreateIndex
CREATE INDEX "equipos_inscripcion_torneoId_activo_idx" ON "equipos_inscripcion"("torneoId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_inscripcion_torneoId_equipoId_key" ON "equipos_inscripcion"("torneoId", "equipoId");

-- CreateIndex
CREATE UNIQUE INDEX "personas_dni_key" ON "personas"("dni");

-- CreateIndex
CREATE INDEX "personas_email_idx" ON "personas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_publicas_googleId_key" ON "cuentas_publicas"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_publicas_email_key" ON "cuentas_publicas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_publicas_personaId_key" ON "cuentas_publicas"("personaId");

-- CreateIndex
CREATE INDEX "cuentas_publicas_rol_idx" ON "cuentas_publicas"("rol");

-- CreateIndex
CREATE INDEX "cuentas_publicas_equipoSeguidoId_idx" ON "cuentas_publicas"("equipoSeguidoId");

-- CreateIndex
CREATE INDEX "cuentas_publicas_dniConfirmado_idx" ON "cuentas_publicas"("dniConfirmado");

-- CreateIndex
CREATE UNIQUE INDEX "capitanes_autorizados_cuentaPublicaId_key" ON "capitanes_autorizados"("cuentaPublicaId");

-- CreateIndex
CREATE INDEX "capitanes_autorizados_email_idx" ON "capitanes_autorizados"("email");

-- CreateIndex
CREATE INDEX "capitanes_autorizados_equipoInscripcionId_idx" ON "capitanes_autorizados"("equipoInscripcionId");

-- CreateIndex
CREATE UNIQUE INDEX "capitanes_autorizados_email_torneoId_key" ON "capitanes_autorizados"("email", "torneoId");

-- CreateIndex
CREATE UNIQUE INDEX "capitanes_autorizados_dni_torneoId_key" ON "capitanes_autorizados"("dni", "torneoId");

-- CreateIndex
CREATE INDEX "inscripciones_jugador_equipoInscripcionId_activa_idx" ON "inscripciones_jugador"("equipoInscripcionId", "activa");

-- CreateIndex
CREATE INDEX "inscripciones_jugador_torneoId_activa_idx" ON "inscripciones_jugador"("torneoId", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_jugador_personaId_torneoId_key" ON "inscripciones_jugador"("personaId", "torneoId");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_canchas_codigo_key" ON "grupos_canchas"("codigo");

-- CreateIndex
CREATE INDEX "canchas_numero_idx" ON "canchas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "canchas_grupoCanchasId_numero_key" ON "canchas"("grupoCanchasId", "numero");

-- CreateIndex
CREATE INDEX "franjas_horarias_grupoCanchasId_orden_idx" ON "franjas_horarias"("grupoCanchasId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "franjas_horarias_grupoCanchasId_horaInicio_key" ON "franjas_horarias"("grupoCanchasId", "horaInicio");

-- CreateIndex
CREATE INDEX "jornadas_torneoId_fecha_idx" ON "jornadas"("torneoId", "fecha");

-- CreateIndex
CREATE INDEX "jornadas_suspendida_idx" ON "jornadas"("suspendida");

-- CreateIndex
CREATE UNIQUE INDEX "jornadas_torneoId_numero_key" ON "jornadas"("torneoId", "numero");

-- CreateIndex
CREATE INDEX "preferencias_horario_torneoId_idx" ON "preferencias_horario"("torneoId");

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_horario_jornadaId_equipoInscripcionId_key" ON "preferencias_horario"("jornadaId", "equipoInscripcionId");

-- CreateIndex
CREATE INDEX "partidos_futbol_status_idx" ON "partidos_futbol"("status");

-- CreateIndex
CREATE INDEX "partidos_futbol_date_idx" ON "partidos_futbol"("date");

-- CreateIndex
CREATE INDEX "partidos_futbol_status_date_idx" ON "partidos_futbol"("status", "date");

-- CreateIndex
CREATE INDEX "partidos_futbol_torneoId_jornadaId_idx" ON "partidos_futbol"("torneoId", "jornadaId");

-- CreateIndex
CREATE INDEX "partidos_futbol_canchaId_date_horaInicio_idx" ON "partidos_futbol"("canchaId", "date", "horaInicio");

-- CreateIndex
CREATE INDEX "eventos_partido_partidoId_idx" ON "eventos_partido"("partidoId");

-- CreateIndex
CREATE INDEX "eventos_partido_personaId_idx" ON "eventos_partido"("personaId");

-- CreateIndex
CREATE INDEX "eventos_partido_tipo_idx" ON "eventos_partido"("tipo");

-- CreateIndex
CREATE INDEX "suspensiones_personaId_activa_idx" ON "suspensiones"("personaId", "activa");

-- CreateIndex
CREATE INDEX "suspensiones_torneoId_activa_idx" ON "suspensiones"("torneoId", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "reglamento_apartados_numero_key" ON "reglamento_apartados"("numero");

-- CreateIndex
CREATE INDEX "reglamento_articulos_aplicable_idx" ON "reglamento_articulos"("aplicable");

-- CreateIndex
CREATE UNIQUE INDEX "reglamento_articulos_apartadoId_numero_key" ON "reglamento_articulos"("apartadoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "reglamento_anexos_numero_key" ON "reglamento_anexos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "reglamento_reglas_anexoId_clave_key" ON "reglamento_reglas"("anexoId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_publicos_ticketVentaId_key" ON "pedidos_publicos"("ticketVentaId");

-- CreateIndex
CREATE INDEX "pedidos_publicos_cuentaPublicaId_idx" ON "pedidos_publicos"("cuentaPublicaId");

-- CreateIndex
CREATE INDEX "pedidos_publicos_status_idx" ON "pedidos_publicos"("status");

-- CreateIndex
CREATE INDEX "pedidos_publicos_createdAt_idx" ON "pedidos_publicos"("createdAt");

-- CreateIndex
CREATE INDEX "pedidos_publicos_cuentaPublicaId_createdAt_idx" ON "pedidos_publicos"("cuentaPublicaId", "createdAt");

-- CreateIndex
CREATE INDEX "pedidos_publicos_status_createdAt_idx" ON "pedidos_publicos"("status", "createdAt");

-- CreateIndex
CREATE INDEX "items_pedido_publico_pedidoId_idx" ON "items_pedido_publico"("pedidoId");

-- CreateIndex
CREATE INDEX "items_pedido_publico_salesProductId_idx" ON "items_pedido_publico"("salesProductId");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_retiro_qr_pedidoId_key" ON "tokens_retiro_qr"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_retiro_qr_token_key" ON "tokens_retiro_qr"("token");

-- CreateIndex
CREATE INDEX "entradas_auditoria_userId_idx" ON "entradas_auditoria"("userId");

-- CreateIndex
CREATE INDEX "entradas_auditoria_createdAt_idx" ON "entradas_auditoria"("createdAt");

-- CreateIndex
CREATE INDEX "entradas_auditoria_userId_createdAt_idx" ON "entradas_auditoria"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "entradas_auditoria_module_createdAt_idx" ON "entradas_auditoria"("module", "createdAt");

-- CreateIndex
CREATE INDEX "movimientos_stock_productId_idx" ON "movimientos_stock"("productId");

-- CreateIndex
CREATE INDEX "movimientos_stock_warehouseId_idx" ON "movimientos_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "movimientos_stock_type_idx" ON "movimientos_stock"("type");

-- CreateIndex
CREATE INDEX "movimientos_stock_createdAt_idx" ON "movimientos_stock"("createdAt");

-- CreateIndex
CREATE INDEX "movimientos_stock_productId_createdAt_idx" ON "movimientos_stock"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "movimientos_stock_type_createdAt_idx" ON "movimientos_stock"("type", "createdAt");

-- CreateIndex
CREATE INDEX "movimientos_stock_reference_idx" ON "movimientos_stock"("reference");

-- CreateIndex
CREATE INDEX "consumos_empleado_productId_idx" ON "consumos_empleado"("productId");

-- CreateIndex
CREATE INDEX "consumos_empleado_warehouseId_idx" ON "consumos_empleado"("warehouseId");

-- CreateIndex
CREATE INDEX "consumos_empleado_day_idx" ON "consumos_empleado"("day");

-- CreateIndex
CREATE INDEX "consumos_empleado_createdAt_idx" ON "consumos_empleado"("createdAt");

-- CreateIndex
CREATE INDEX "consumos_empleado_day_productId_idx" ON "consumos_empleado"("day", "productId");

-- CreateIndex
CREATE INDEX "sesiones_conteo_date_idx" ON "sesiones_conteo"("date");

-- CreateIndex
CREATE INDEX "sesiones_conteo_createdAt_idx" ON "sesiones_conteo"("createdAt");

-- CreateIndex
CREATE INDEX "entradas_conteo_sessionId_idx" ON "entradas_conteo"("sessionId");

-- CreateIndex
CREATE INDEX "entradas_conteo_productId_idx" ON "entradas_conteo"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "entradas_conteo_sessionId_productId_key" ON "entradas_conteo"("sessionId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_orderNumber_key" ON "ordenes_compra"("orderNumber");

-- CreateIndex
CREATE INDEX "ordenes_compra_status_idx" ON "ordenes_compra"("status");

-- CreateIndex
CREATE INDEX "ordenes_compra_date_idx" ON "ordenes_compra"("date");

-- CreateIndex
CREATE INDEX "ordenes_compra_createdAt_idx" ON "ordenes_compra"("createdAt");

-- CreateIndex
CREATE INDEX "ordenes_compra_status_createdAt_idx" ON "ordenes_compra"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ordenes_compra_supplierId_idx" ON "ordenes_compra"("supplierId");

-- CreateIndex
CREATE INDEX "items_orden_compra_purchaseOrderId_idx" ON "items_orden_compra"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "items_orden_compra_productId_idx" ON "items_orden_compra"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "items_orden_compra_purchaseOrderId_productId_key" ON "items_orden_compra"("purchaseOrderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_key_key" ON "configuraciones"("key");

-- CreateIndex
CREATE INDEX "configuraciones_scope_idx" ON "configuraciones"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_venta_name_key" ON "categorias_venta"("name");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveles_stock" ADD CONSTRAINT "niveles_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveles_stock" ADD CONSTRAINT "niveles_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "depositos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores_productos" ADD CONSTRAINT "proveedores_productos_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores_productos" ADD CONSTRAINT "proveedores_productos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_venta_filtros" ADD CONSTRAINT "productos_venta_filtros_producto_venta_id_fkey" FOREIGN KEY ("producto_venta_id") REFERENCES "productos_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_venta_filtros" ADD CONSTRAINT "productos_venta_filtros_filtro_web_id_fkey" FOREIGN KEY ("filtro_web_id") REFERENCES "filtros_web"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_venta" ADD CONSTRAINT "productos_venta_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "cocinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_venta" ADD CONSTRAINT "productos_venta_categoria_web_id_fkey" FOREIGN KEY ("categoria_web_id") REFERENCES "categorias_web"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_combo_venta" ADD CONSTRAINT "items_combo_venta_promoProductId_fkey" FOREIGN KEY ("promoProductId") REFERENCES "productos_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_combo_venta" ADD CONSTRAINT "items_combo_venta_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "productos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_receta" ADD CONSTRAINT "items_receta_salesProductId_fkey" FOREIGN KEY ("salesProductId") REFERENCES "productos_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_receta" ADD CONSTRAINT "items_receta_stockProductId_fkey" FOREIGN KEY ("stockProductId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_venta" ADD CONSTRAINT "tickets_venta_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_ticket_venta" ADD CONSTRAINT "items_ticket_venta_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_ticket_venta" ADD CONSTRAINT "items_ticket_venta_salesProductId_fkey" FOREIGN KEY ("salesProductId") REFERENCES "productos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_cocina" ADD CONSTRAINT "ordenes_cocina_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_cocina" ADD CONSTRAINT "ordenes_cocina_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "cocinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_cocina" ADD CONSTRAINT "ordenes_cocina_pedidoPublicoId_fkey" FOREIGN KEY ("pedidoPublicoId") REFERENCES "pedidos_publicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_orden_cocina" ADD CONSTRAINT "items_orden_cocina_kitchenOrderId_fkey" FOREIGN KEY ("kitchenOrderId") REFERENCES "ordenes_cocina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_orden_cocina" ADD CONSTRAINT "items_orden_cocina_salesProductId_fkey" FOREIGN KEY ("salesProductId") REFERENCES "productos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campeonatos" ADD CONSTRAINT "campeonatos_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "temporadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_config" ADD CONSTRAINT "categorias_config_grupoCanchasId_fkey" FOREIGN KEY ("grupoCanchasId") REFERENCES "grupos_canchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_campeonatoId_fkey" FOREIGN KEY ("campeonatoId") REFERENCES "campeonatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneos_config" ADD CONSTRAINT "torneos_config_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos_inscripcion" ADD CONSTRAINT "equipos_inscripcion_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos_inscripcion" ADD CONSTRAINT "equipos_inscripcion_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos_futbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_publicas" ADD CONSTRAINT "cuentas_publicas_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_publicas" ADD CONSTRAINT "cuentas_publicas_equipoSeguidoId_fkey" FOREIGN KEY ("equipoSeguidoId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capitanes_autorizados" ADD CONSTRAINT "capitanes_autorizados_equipoInscripcionId_fkey" FOREIGN KEY ("equipoInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capitanes_autorizados" ADD CONSTRAINT "capitanes_autorizados_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capitanes_autorizados" ADD CONSTRAINT "capitanes_autorizados_cuentaPublicaId_fkey" FOREIGN KEY ("cuentaPublicaId") REFERENCES "cuentas_publicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones_jugador" ADD CONSTRAINT "inscripciones_jugador_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones_jugador" ADD CONSTRAINT "inscripciones_jugador_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones_jugador" ADD CONSTRAINT "inscripciones_jugador_equipoInscripcionId_fkey" FOREIGN KEY ("equipoInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canchas" ADD CONSTRAINT "canchas_grupoCanchasId_fkey" FOREIGN KEY ("grupoCanchasId") REFERENCES "grupos_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franjas_horarias" ADD CONSTRAINT "franjas_horarias_grupoCanchasId_fkey" FOREIGN KEY ("grupoCanchasId") REFERENCES "grupos_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_horario" ADD CONSTRAINT "preferencias_horario_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_horario" ADD CONSTRAINT "preferencias_horario_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "jornadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_horario" ADD CONSTRAINT "preferencias_horario_equipoInscripcionId_fkey" FOREIGN KEY ("equipoInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "equipos_futbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "equipos_futbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "jornadas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_homeInscripcionId_fkey" FOREIGN KEY ("homeInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_awayInscripcionId_fkey" FOREIGN KEY ("awayInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "canchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_equipoLibreId_fkey" FOREIGN KEY ("equipoLibreId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_partido" ADD CONSTRAINT "eventos_partido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "partidos_futbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_partido" ADD CONSTRAINT "eventos_partido_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensiones" ADD CONSTRAINT "suspensiones_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensiones" ADD CONSTRAINT "suspensiones_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglamento_articulos" ADD CONSTRAINT "reglamento_articulos_apartadoId_fkey" FOREIGN KEY ("apartadoId") REFERENCES "reglamento_apartados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglamento_reglas" ADD CONSTRAINT "reglamento_reglas_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "reglamento_anexos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_publicos" ADD CONSTRAINT "pedidos_publicos_cuentaPublicaId_fkey" FOREIGN KEY ("cuentaPublicaId") REFERENCES "cuentas_publicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_publicos" ADD CONSTRAINT "pedidos_publicos_ticketVentaId_fkey" FOREIGN KEY ("ticketVentaId") REFERENCES "tickets_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido_publico" ADD CONSTRAINT "items_pedido_publico_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_publicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_pedido_publico" ADD CONSTRAINT "items_pedido_publico_salesProductId_fkey" FOREIGN KEY ("salesProductId") REFERENCES "productos_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_retiro_qr" ADD CONSTRAINT "tokens_retiro_qr_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_publicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas_auditoria" ADD CONSTRAINT "entradas_auditoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_empleado" ADD CONSTRAINT "consumos_empleado_productId_fkey" FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_empleado" ADD CONSTRAINT "consumos_empleado_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas_conteo" ADD CONSTRAINT "entradas_conteo_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sesiones_conteo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas_conteo" ADD CONSTRAINT "entradas_conteo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_orden_compra" ADD CONSTRAINT "items_orden_compra_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_orden_compra" ADD CONSTRAINT "items_orden_compra_productId_fkey" FOREIGN KEY ("productId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

