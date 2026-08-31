-- Fase A1: plataforma pública — torneo, auth pública, reglamento, cantina, scheduling

-- ========== ALTER EXISTING ==========
ALTER TABLE "equipos_futbol" ADD COLUMN IF NOT EXISTS "color" TEXT;

ALTER TABLE "productos_venta" ADD COLUMN IF NOT EXISTS "visibleWeb" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "productos_venta" ADD COLUMN IF NOT EXISTS "descripcionWeb" TEXT;
ALTER TABLE "productos_venta" ADD COLUMN IF NOT EXISTS "imagenWeb" TEXT;

ALTER TABLE "tickets_venta" ADD COLUMN IF NOT EXISTS "origen" TEXT NOT NULL DEFAULT 'pos';

ALTER TABLE "ordenes_cocina" ADD COLUMN IF NOT EXISTS "pedidoPublicoId" TEXT;

ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "torneoId" TEXT;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "jornadaId" TEXT;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "homeInscripcionId" TEXT;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "awayInscripcionId" TEXT;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "canchaId" TEXT;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "horaInicio" TEXT;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "bloqueadoManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "equipoLibreId" TEXT;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "esWO" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "partidos_futbol" ADD COLUMN IF NOT EXISTS "motivoWO" TEXT;

CREATE INDEX IF NOT EXISTS "productos_venta_visibleWeb_active_idx" ON "productos_venta"("visibleWeb", "active");
CREATE INDEX IF NOT EXISTS "tickets_venta_origen_idx" ON "tickets_venta"("origen");
CREATE INDEX IF NOT EXISTS "ordenes_cocina_pedidoPublicoId_idx" ON "ordenes_cocina"("pedidoPublicoId");
CREATE INDEX IF NOT EXISTS "partidos_futbol_torneoId_jornadaId_idx" ON "partidos_futbol"("torneoId", "jornadaId");
CREATE INDEX IF NOT EXISTS "partidos_futbol_canchaId_date_horaInicio_idx" ON "partidos_futbol"("canchaId", "date", "horaInicio");

-- ========== TORNEO / TEMPORADA ==========
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

CREATE UNIQUE INDEX "temporadas_anio_key" ON "temporadas"("anio");
CREATE INDEX "temporadas_activa_idx" ON "temporadas"("activa");

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

CREATE UNIQUE INDEX "campeonatos_temporadaId_nombre_key" ON "campeonatos"("temporadaId", "nombre");
CREATE INDEX "campeonatos_activo_idx" ON "campeonatos"("activo");

CREATE TABLE "grupos_canchas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grupos_canchas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grupos_canchas_codigo_key" ON "grupos_canchas"("codigo");

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

CREATE UNIQUE INDEX "categorias_config_codigo_key" ON "categorias_config"("codigo");

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

CREATE UNIQUE INDEX "torneos_campeonatoId_categoriaId_key" ON "torneos"("campeonatoId", "categoriaId");
CREATE INDEX "torneos_activo_publicado_idx" ON "torneos"("activo", "publicado");

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

CREATE UNIQUE INDEX "torneos_config_torneoId_key" ON "torneos_config"("torneoId");

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

CREATE UNIQUE INDEX "equipos_inscripcion_torneoId_equipoId_key" ON "equipos_inscripcion"("torneoId", "equipoId");
CREATE INDEX "equipos_inscripcion_torneoId_activo_idx" ON "equipos_inscripcion"("torneoId", "activo");

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

CREATE UNIQUE INDEX "canchas_grupoCanchasId_numero_key" ON "canchas"("grupoCanchasId", "numero");
CREATE INDEX "canchas_numero_idx" ON "canchas"("numero");

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

CREATE UNIQUE INDEX "franjas_horarias_grupoCanchasId_horaInicio_key" ON "franjas_horarias"("grupoCanchasId", "horaInicio");
CREATE INDEX "franjas_horarias_grupoCanchasId_orden_idx" ON "franjas_horarias"("grupoCanchasId", "orden");

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

CREATE UNIQUE INDEX "jornadas_torneoId_numero_key" ON "jornadas"("torneoId", "numero");
CREATE INDEX "jornadas_torneoId_fecha_idx" ON "jornadas"("torneoId", "fecha");
CREATE INDEX "jornadas_suspendida_idx" ON "jornadas"("suspendida");

CREATE TABLE "preferencias_horario" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "jornadaId" TEXT NOT NULL,
    "equipoInscripcionId" TEXT NOT NULL,
    "horaPreferida" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "preferencias_horario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preferencias_horario_jornadaId_equipoInscripcionId_key" ON "preferencias_horario"("jornadaId", "equipoInscripcionId");
CREATE INDEX "preferencias_horario_torneoId_idx" ON "preferencias_horario"("torneoId");

-- ========== PERSONAS / AUTH PÚBLICA ==========
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

CREATE UNIQUE INDEX "personas_dni_key" ON "personas"("dni");
CREATE INDEX "personas_email_idx" ON "personas"("email");

CREATE TABLE "cuentas_publicas" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
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

CREATE UNIQUE INDEX "cuentas_publicas_googleId_key" ON "cuentas_publicas"("googleId");
CREATE UNIQUE INDEX "cuentas_publicas_email_key" ON "cuentas_publicas"("email");
CREATE UNIQUE INDEX "cuentas_publicas_personaId_key" ON "cuentas_publicas"("personaId");
CREATE INDEX "cuentas_publicas_rol_idx" ON "cuentas_publicas"("rol");
CREATE INDEX "cuentas_publicas_equipoSeguidoId_idx" ON "cuentas_publicas"("equipoSeguidoId");

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

CREATE UNIQUE INDEX "capitanes_autorizados_email_torneoId_key" ON "capitanes_autorizados"("email", "torneoId");
CREATE UNIQUE INDEX "capitanes_autorizados_dni_torneoId_key" ON "capitanes_autorizados"("dni", "torneoId");
CREATE UNIQUE INDEX "capitanes_autorizados_cuentaPublicaId_key" ON "capitanes_autorizados"("cuentaPublicaId");
CREATE INDEX "capitanes_autorizados_email_idx" ON "capitanes_autorizados"("email");
CREATE INDEX "capitanes_autorizados_equipoInscripcionId_idx" ON "capitanes_autorizados"("equipoInscripcionId");

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

CREATE UNIQUE INDEX "inscripciones_jugador_personaId_torneoId_key" ON "inscripciones_jugador"("personaId", "torneoId");
CREATE INDEX "inscripciones_jugador_equipoInscripcionId_activa_idx" ON "inscripciones_jugador"("equipoInscripcionId", "activa");
CREATE INDEX "inscripciones_jugador_torneoId_activa_idx" ON "inscripciones_jugador"("torneoId", "activa");

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

CREATE INDEX "eventos_partido_partidoId_idx" ON "eventos_partido"("partidoId");
CREATE INDEX "eventos_partido_personaId_idx" ON "eventos_partido"("personaId");
CREATE INDEX "eventos_partido_tipo_idx" ON "eventos_partido"("tipo");

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

CREATE INDEX "suspensiones_personaId_activa_idx" ON "suspensiones"("personaId", "activa");
CREATE INDEX "suspensiones_torneoId_activa_idx" ON "suspensiones"("torneoId", "activa");

-- ========== REGLAMENTO ==========
CREATE TABLE "reglamento_apartados" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reglamento_apartados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reglamento_apartados_numero_key" ON "reglamento_apartados"("numero");

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

CREATE UNIQUE INDEX "reglamento_articulos_apartadoId_numero_key" ON "reglamento_articulos"("apartadoId", "numero");
CREATE INDEX "reglamento_articulos_aplicable_idx" ON "reglamento_articulos"("aplicable");

CREATE TABLE "reglamento_anexos" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reglamento_anexos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reglamento_anexos_numero_key" ON "reglamento_anexos"("numero");

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

CREATE UNIQUE INDEX "reglamento_reglas_anexoId_clave_key" ON "reglamento_reglas"("anexoId", "clave");

-- ========== CANTINA PÚBLICA ==========
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

CREATE UNIQUE INDEX "pedidos_publicos_ticketVentaId_key" ON "pedidos_publicos"("ticketVentaId");
CREATE INDEX "pedidos_publicos_cuentaPublicaId_idx" ON "pedidos_publicos"("cuentaPublicaId");
CREATE INDEX "pedidos_publicos_status_idx" ON "pedidos_publicos"("status");
CREATE INDEX "pedidos_publicos_createdAt_idx" ON "pedidos_publicos"("createdAt");

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

CREATE INDEX "items_pedido_publico_pedidoId_idx" ON "items_pedido_publico"("pedidoId");

CREATE TABLE "tokens_retiro_qr" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "invalido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tokens_retiro_qr_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_retiro_qr_pedidoId_key" ON "tokens_retiro_qr"("pedidoId");
CREATE UNIQUE INDEX "tokens_retiro_qr_token_key" ON "tokens_retiro_qr"("token");
CREATE INDEX "tokens_retiro_qr_token_idx" ON "tokens_retiro_qr"("token");

-- ========== FOREIGN KEYS ==========
ALTER TABLE "campeonatos" ADD CONSTRAINT "campeonatos_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "temporadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorias_config" ADD CONSTRAINT "categorias_config_grupoCanchasId_fkey" FOREIGN KEY ("grupoCanchasId") REFERENCES "grupos_canchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_campeonatoId_fkey" FOREIGN KEY ("campeonatoId") REFERENCES "campeonatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "torneos_config" ADD CONSTRAINT "torneos_config_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipos_inscripcion" ADD CONSTRAINT "equipos_inscripcion_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipos_inscripcion" ADD CONSTRAINT "equipos_inscripcion_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos_futbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canchas" ADD CONSTRAINT "canchas_grupoCanchasId_fkey" FOREIGN KEY ("grupoCanchasId") REFERENCES "grupos_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "franjas_horarias" ADD CONSTRAINT "franjas_horarias_grupoCanchasId_fkey" FOREIGN KEY ("grupoCanchasId") REFERENCES "grupos_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preferencias_horario" ADD CONSTRAINT "preferencias_horario_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preferencias_horario" ADD CONSTRAINT "preferencias_horario_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "jornadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preferencias_horario" ADD CONSTRAINT "preferencias_horario_equipoInscripcionId_fkey" FOREIGN KEY ("equipoInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cuentas_publicas" ADD CONSTRAINT "cuentas_publicas_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cuentas_publicas" ADD CONSTRAINT "cuentas_publicas_equipoSeguidoId_fkey" FOREIGN KEY ("equipoSeguidoId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capitanes_autorizados" ADD CONSTRAINT "capitanes_autorizados_equipoInscripcionId_fkey" FOREIGN KEY ("equipoInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capitanes_autorizados" ADD CONSTRAINT "capitanes_autorizados_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capitanes_autorizados" ADD CONSTRAINT "capitanes_autorizados_cuentaPublicaId_fkey" FOREIGN KEY ("cuentaPublicaId") REFERENCES "cuentas_publicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inscripciones_jugador" ADD CONSTRAINT "inscripciones_jugador_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inscripciones_jugador" ADD CONSTRAINT "inscripciones_jugador_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inscripciones_jugador" ADD CONSTRAINT "inscripciones_jugador_equipoInscripcionId_fkey" FOREIGN KEY ("equipoInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_partido" ADD CONSTRAINT "eventos_partido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "partidos_futbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_partido" ADD CONSTRAINT "eventos_partido_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suspensiones" ADD CONSTRAINT "suspensiones_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reglamento_articulos" ADD CONSTRAINT "reglamento_articulos_apartadoId_fkey" FOREIGN KEY ("apartadoId") REFERENCES "reglamento_apartados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reglamento_reglas" ADD CONSTRAINT "reglamento_reglas_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "reglamento_anexos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedidos_publicos" ADD CONSTRAINT "pedidos_publicos_cuentaPublicaId_fkey" FOREIGN KEY ("cuentaPublicaId") REFERENCES "cuentas_publicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedidos_publicos" ADD CONSTRAINT "pedidos_publicos_ticketVentaId_fkey" FOREIGN KEY ("ticketVentaId") REFERENCES "tickets_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items_pedido_publico" ADD CONSTRAINT "items_pedido_publico_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_publicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tokens_retiro_qr" ADD CONSTRAINT "tokens_retiro_qr_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_publicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ordenes_cocina" ADD CONSTRAINT "ordenes_cocina_pedidoPublicoId_fkey" FOREIGN KEY ("pedidoPublicoId") REFERENCES "pedidos_publicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "jornadas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_homeInscripcionId_fkey" FOREIGN KEY ("homeInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_awayInscripcionId_fkey" FOREIGN KEY ("awayInscripcionId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "canchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_equipoLibreId_fkey" FOREIGN KEY ("equipoLibreId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
