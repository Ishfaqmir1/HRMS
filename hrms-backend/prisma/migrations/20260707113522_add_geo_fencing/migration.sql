-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "geoFenceRadiusMeters" INTEGER DEFAULT 500,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
