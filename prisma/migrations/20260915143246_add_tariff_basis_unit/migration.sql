-- CreateEnum
CREATE TYPE "TariffBasis" AS ENUM ('KG', 'LB', 'CFT');

-- AlterTable
ALTER TABLE "consolidator_tariff_component" ADD COLUMN     "basis_unit" "TariffBasis";

-- AlterTable
ALTER TABLE "customs_agent_tariff_component" ADD COLUMN     "basis_unit" "TariffBasis";
