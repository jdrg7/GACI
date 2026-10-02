-- AlterTable
ALTER TABLE "customs_agent_tariff_component" ADD COLUMN     "is_tax" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "quotation_cost_detail" ADD COLUMN     "is_tax" BOOLEAN NOT NULL DEFAULT false;
