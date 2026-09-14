-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlacementPatrocinador" ADD VALUE 'home';
ALTER TYPE "PlacementPatrocinador" ADD VALUE 'cantina';

-- AlterTable
ALTER TABLE "patrocinadores" ADD COLUMN     "duration_seconds" INTEGER NOT NULL DEFAULT 5;
