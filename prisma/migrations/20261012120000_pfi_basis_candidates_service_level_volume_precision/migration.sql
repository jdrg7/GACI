-- CreateEnum
CREATE TYPE "ServiceLevel" AS ENUM ('REGULAR', 'PRIORITY');

-- AlterTable
ALTER TABLE "consolidator_tariff" ADD COLUMN     "volumetric_divisor" DECIMAL(8,2) NOT NULL DEFAULT 166;

-- AlterTable
ALTER TABLE "consolidator_tariff_component" ADD COLUMN     "basis_candidates" JSONB,
ADD COLUMN     "service_level" "ServiceLevel";

-- AlterTable
ALTER TABLE "pallet" ALTER COLUMN "volume_cft" SET DATA TYPE DECIMAL(12,6);

-- AlterTable
ALTER TABLE "product" ALTER COLUMN "volume_cft" SET DATA TYPE DECIMAL(12,6);

-- AlterTable
ALTER TABLE "quotation" ALTER COLUMN "total_volume_cft" SET DATA TYPE DECIMAL(12,6);

-- AlterTable
ALTER TABLE "quotation_product" ALTER COLUMN "volume_cft_override" SET DATA TYPE DECIMAL(12,6),
ALTER COLUMN "volume_cft_used" SET DATA TYPE DECIMAL(12,6);
