-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "scenario_chosen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "service_level" "ServiceLevel" NOT NULL DEFAULT 'REGULAR';

-- AlterTable
ALTER TABLE "quotation_cost_detail" ADD COLUMN     "scenario_id" UUID;

-- CreateTable
CREATE TABLE "quotation_scenario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "transport_type" "TransportType" NOT NULL,
    "consolidator_tariff_id" UUID NOT NULL,
    "volumetric_weight_lb" DECIMAL(14,3) NOT NULL,
    "chargeable_weight_kg" DECIMAL(14,3) NOT NULL,
    "subtotal_consolidator" DECIMAL(14,4) NOT NULL,
    "cif" DECIMAL(14,4) NOT NULL,
    "subtotal_customs_agent" DECIMAL(14,4) NOT NULL,
    "total_cost" DECIMAL(14,4) NOT NULL,
    "margin_amount" DECIMAL(14,4) NOT NULL,
    "margin_percentage" DECIMAL(8,4) NOT NULL,
    "sale_price" DECIMAL(14,4) NOT NULL,
    "nationalization_base" DECIMAL(14,4) NOT NULL,
    "nationalization_percentage" DECIMAL(8,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_scenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_scenario_quotation_id_idx" ON "quotation_scenario"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_scenario_quotation_id_transport_type_key" ON "quotation_scenario"("quotation_id", "transport_type");

-- CreateIndex
CREATE INDEX "quotation_cost_detail_scenario_id_idx" ON "quotation_cost_detail"("scenario_id");

-- AddForeignKey
ALTER TABLE "quotation_scenario" ADD CONSTRAINT "quotation_scenario_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_scenario" ADD CONSTRAINT "quotation_scenario_consolidator_tariff_id_fkey" FOREIGN KEY ("consolidator_tariff_id") REFERENCES "consolidator_tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_cost_detail" ADD CONSTRAINT "quotation_cost_detail_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "quotation_scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: cada cotización existente recibe un único escenario (su modo actual) con sus
-- propios totales, y sus líneas de costo se enlazan a él. No borra ni recalcula nada.
INSERT INTO "quotation_scenario" (
  "id", "quotation_id", "transport_type", "consolidator_tariff_id",
  "volumetric_weight_lb", "chargeable_weight_kg",
  "subtotal_consolidator", "cif", "subtotal_customs_agent", "total_cost",
  "margin_amount", "margin_percentage", "sale_price",
  "nationalization_base", "nationalization_percentage",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), q."id", q."transport_type", q."consolidator_tariff_id",
  ROUND((q."total_volume_cft" * 1728 / 166)::numeric, 3),
  ROUND(GREATEST(q."total_weight_kg", q."total_volume_cft" * 1728 / 166 / 2.2046)::numeric, 3),
  q."subtotal_consolidator", q."cif", q."subtotal_customs_agent", q."total_cost",
  q."margin_amount", q."margin_percentage", q."sale_price",
  q."nationalization_base", q."nationalization_percentage",
  q."created_at", CURRENT_TIMESTAMP
FROM "quotation" q;

UPDATE "quotation_cost_detail" d
SET "scenario_id" = s."id"
FROM "quotation_scenario" s
WHERE s."quotation_id" = d."quotation_id";