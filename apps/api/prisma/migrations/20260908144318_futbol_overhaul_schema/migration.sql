-- AlterEnum
ALTER TYPE "TipoEventoPartido" ADD VALUE 'gol_en_contra';

-- AlterTable
ALTER TABLE "jornadas" ADD COLUMN     "equipoLibreId" TEXT;

-- AlterTable
ALTER TABLE "partidos_futbol" ADD COLUMN     "reemplazaAId" TEXT;

-- AlterTable
ALTER TABLE "suspensiones" ADD COLUMN     "ajustadoManualmente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pendienteDefinir" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "fechasRestantes" DROP NOT NULL,
ALTER COLUMN "fechasRestantes" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "partidos_futbol_reemplazaAId_key" ON "partidos_futbol"("reemplazaAId");

-- AddForeignKey
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_equipoLibreId_fkey" FOREIGN KEY ("equipoLibreId") REFERENCES "equipos_inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos_futbol" ADD CONSTRAINT "partidos_futbol_reemplazaAId_fkey" FOREIGN KEY ("reemplazaAId") REFERENCES "partidos_futbol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

