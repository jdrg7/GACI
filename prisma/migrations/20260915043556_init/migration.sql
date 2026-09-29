-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COMERCIAL', 'OPERACIONES');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('QUOTATION_CREATE', 'QUOTATION_VIEW', 'QUOTATION_EDIT', 'QUOTATION_CHANGE_STATE', 'QUOTATION_CREATE_DRAFT', 'QUOTATION_VIEW_OPP', 'QUOTATION_EDIT_AFTER_SENT', 'QUOTATION_COMPARE', 'MASTER_DATA_VIEW', 'MASTER_DATA_EDIT', 'TARIFF_VIEW', 'TARIFF_EDIT', 'USER_MANAGE', 'ROLE_MANAGE', 'COUNTRY_CONFIG_EDIT', 'EXCHANGE_RATE_EDIT');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('BORRADOR', 'PENDIENTE', 'ENVIADA', 'VIGENTE', 'GANADA', 'EN_PROCESO', 'ALTERNATIVA', 'CERRADA', 'RECHAZADA', 'CANCELADA', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('AEREO', 'MARITIMO');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('FIXED', 'PER_KG', 'PER_LB', 'PER_CFT', 'PER_VALUE', 'MAX_OF', 'RANGE_KG', 'RANGE_LB', 'RANGE_CFT', 'RANGE_VALUE');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('CONSOLIDATOR', 'CUSTOMS_AGENT', 'INSURANCE', 'OTHER_INTERNATIONAL');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "permission" "Permission" NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" UUID NOT NULL,

    CONSTRAINT "user_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "currency_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_currency_id" UUID NOT NULL,
    "to_currency_id" UUID NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "tax_id" VARCHAR(50),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "country_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "country" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sku" VARCHAR(100),
    "supplier_id" UUID,
    "weight_kg" DECIMAL(10,3) NOT NULL,
    "weight_lb" DECIMAL(10,3) NOT NULL,
    "volume_cft" DECIMAL(10,3) NOT NULL,
    "customs_code" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidator" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consolidator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_agent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "license_number" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customs_agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "max_weight_kg" DECIMAL(10,3) NOT NULL,
    "length_cm" DECIMAL(8,2) NOT NULL,
    "width_cm" DECIMAL(8,2) NOT NULL,
    "height_cm" DECIMAL(8,2) NOT NULL,
    "volume_cft" DECIMAL(10,3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidator_tariff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consolidator_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "transport_type" "TransportType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID NOT NULL,

    CONSTRAINT "consolidator_tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidator_tariff_component" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consolidator_tariff_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "calculation_type" "CalculationType" NOT NULL,
    "currency_id" UUID NOT NULL,
    "fixed_amount" DECIMAL(12,4),
    "rate_per_unit" DECIMAL(12,6),
    "rate_percentage" DECIMAL(8,6),
    "minimum_amount" DECIMAL(12,4),
    "maximum_amount" DECIMAL(12,4),
    "tariff_ranges" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consolidator_tariff_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_agent_tariff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customs_agent_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID NOT NULL,

    CONSTRAINT "customs_agent_tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_agent_tariff_component" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customs_agent_tariff_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" "CostCategory" NOT NULL,
    "calculation_type" "CalculationType" NOT NULL,
    "currency_id" UUID NOT NULL,
    "fixed_amount" DECIMAL(12,4),
    "rate_per_unit" DECIMAL(12,6),
    "rate_percentage" DECIMAL(8,6),
    "minimum_amount" DECIMAL(12,4),
    "maximum_amount" DECIMAL(12,4),
    "tariff_ranges" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customs_agent_tariff_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference_number" VARCHAR(50) NOT NULL,
    "opportunity_id" INTEGER,
    "status" "QuotationStatus" NOT NULL DEFAULT 'BORRADOR',
    "transport_type" "TransportType" NOT NULL,
    "client_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "consolidator_id" UUID NOT NULL,
    "customs_agent_id" UUID NOT NULL,
    "consolidator_tariff_id" UUID NOT NULL,
    "customs_agent_tariff_id" UUID NOT NULL,
    "pallet_id" UUID,
    "exchange_rate" DECIMAL(18,6) NOT NULL,
    "exchange_rate_date" DATE NOT NULL,
    "total_weight_kg" DECIMAL(10,3) NOT NULL,
    "total_weight_lb" DECIMAL(10,3) NOT NULL,
    "total_volume_cft" DECIMAL(10,3) NOT NULL,
    "fob" DECIMAL(14,4) NOT NULL,
    "insurance" DECIMAL(14,4) NOT NULL,
    "other_international_costs" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "subtotal_consolidator" DECIMAL(14,4) NOT NULL,
    "cif" DECIMAL(14,4) NOT NULL,
    "subtotal_customs_agent" DECIMAL(14,4) NOT NULL,
    "total_cost" DECIMAL(14,4) NOT NULL,
    "margin_amount" DECIMAL(14,4) NOT NULL,
    "margin_percentage" DECIMAL(8,4) NOT NULL,
    "sale_price" DECIMAL(14,4) NOT NULL,
    "nationalization_base" DECIMAL(14,4) NOT NULL,
    "nationalization_percentage" DECIMAL(8,4) NOT NULL,
    "observations" TEXT,
    "internal_notes" TEXT,
    "responsible_user_id" UUID NOT NULL,
    "sent_at" TIMESTAMP(3),
    "won_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "weight_kg_override" DECIMAL(10,3),
    "weight_lb_override" DECIMAL(10,3),
    "volume_cft_override" DECIMAL(10,3),
    "weight_kg_used" DECIMAL(10,3) NOT NULL,
    "weight_lb_used" DECIMAL(10,3) NOT NULL,
    "volume_cft_used" DECIMAL(10,3) NOT NULL,
    "fob_unit_price" DECIMAL(14,4) NOT NULL,
    "fob_total" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_cost_detail" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "category" "CostCategory" NOT NULL,
    "component_name" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "consolidator_tariff_component_id" UUID,
    "customs_agent_tariff_component_id" UUID,
    "calculation_snapshot" JSONB NOT NULL,
    "original_amount" DECIMAL(14,4) NOT NULL,
    "original_currency" VARCHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,6),
    "amount_usd" DECIMAL(14,4) NOT NULL,
    "calculation_basis" VARCHAR(50),
    "basis_value" DECIMAL(14,4),
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_cost_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_state_change" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "from_status" "QuotationStatus" NOT NULL,
    "to_status" "QuotationStatus" NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "audit_state_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_data_change" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "ip_address" VARCHAR(45),

    CONSTRAINT "audit_data_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "document_type" VARCHAR(100) NOT NULL,
    "url" TEXT NOT NULL,
    "file_size_kb" INTEGER,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "quotation_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_is_active_idx" ON "user"("role", "is_active");

-- CreateIndex
CREATE INDEX "user_deleted_at_idx" ON "user"("deleted_at");

-- CreateIndex
CREATE INDEX "user_permission_user_id_idx" ON "user_permission"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_user_id_permission_key" ON "user_permission"("user_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "country_code_key" ON "country"("code");

-- CreateIndex
CREATE INDEX "country_code_idx" ON "country"("code");

-- CreateIndex
CREATE INDEX "country_is_active_idx" ON "country"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "currency_code_key" ON "currency"("code");

-- CreateIndex
CREATE INDEX "currency_code_idx" ON "currency"("code");

-- CreateIndex
CREATE INDEX "exchange_rate_from_currency_id_to_currency_id_date_idx" ON "exchange_rate"("from_currency_id", "to_currency_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_from_currency_id_to_currency_id_date_key" ON "exchange_rate"("from_currency_id", "to_currency_id", "date");

-- CreateIndex
CREATE INDEX "client_name_idx" ON "client"("name");

-- CreateIndex
CREATE INDEX "client_country_id_is_active_idx" ON "client"("country_id", "is_active");

-- CreateIndex
CREATE INDEX "client_deleted_at_idx" ON "client"("deleted_at");

-- CreateIndex
CREATE INDEX "supplier_name_idx" ON "supplier"("name");

-- CreateIndex
CREATE INDEX "supplier_deleted_at_idx" ON "supplier"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE INDEX "product_name_idx" ON "product"("name");

-- CreateIndex
CREATE INDEX "product_sku_idx" ON "product"("sku");

-- CreateIndex
CREATE INDEX "product_supplier_id_idx" ON "product"("supplier_id");

-- CreateIndex
CREATE INDEX "product_deleted_at_idx" ON "product"("deleted_at");

-- CreateIndex
CREATE INDEX "consolidator_name_idx" ON "consolidator"("name");

-- CreateIndex
CREATE INDEX "consolidator_is_active_idx" ON "consolidator"("is_active");

-- CreateIndex
CREATE INDEX "consolidator_deleted_at_idx" ON "consolidator"("deleted_at");

-- CreateIndex
CREATE INDEX "customs_agent_name_idx" ON "customs_agent"("name");

-- CreateIndex
CREATE INDEX "customs_agent_is_active_idx" ON "customs_agent"("is_active");

-- CreateIndex
CREATE INDEX "customs_agent_deleted_at_idx" ON "customs_agent"("deleted_at");

-- CreateIndex
CREATE INDEX "pallet_is_active_idx" ON "pallet"("is_active");

-- CreateIndex
CREATE INDEX "consolidator_tariff_consolidator_id_country_id_transport_ty_idx" ON "consolidator_tariff"("consolidator_id", "country_id", "transport_type", "valid_from");

-- CreateIndex
CREATE INDEX "consolidator_tariff_is_active_valid_from_valid_until_idx" ON "consolidator_tariff"("is_active", "valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "consolidator_tariff_component_consolidator_tariff_id_sort_o_idx" ON "consolidator_tariff_component"("consolidator_tariff_id", "sort_order");

-- CreateIndex
CREATE INDEX "customs_agent_tariff_customs_agent_id_country_id_valid_from_idx" ON "customs_agent_tariff"("customs_agent_id", "country_id", "valid_from");

-- CreateIndex
CREATE INDEX "customs_agent_tariff_is_active_valid_from_valid_until_idx" ON "customs_agent_tariff"("is_active", "valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "customs_agent_tariff_component_customs_agent_tariff_id_sort_idx" ON "customs_agent_tariff_component"("customs_agent_tariff_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_reference_number_key" ON "quotation"("reference_number");

-- CreateIndex
CREATE INDEX "quotation_opportunity_id_idx" ON "quotation"("opportunity_id");

-- CreateIndex
CREATE INDEX "quotation_status_idx" ON "quotation"("status");

-- CreateIndex
CREATE INDEX "quotation_client_id_status_idx" ON "quotation"("client_id", "status");

-- CreateIndex
CREATE INDEX "quotation_responsible_user_id_status_idx" ON "quotation"("responsible_user_id", "status");

-- CreateIndex
CREATE INDEX "quotation_country_id_status_idx" ON "quotation"("country_id", "status");

-- CreateIndex
CREATE INDEX "quotation_consolidator_id_idx" ON "quotation"("consolidator_id");

-- CreateIndex
CREATE INDEX "quotation_customs_agent_id_idx" ON "quotation"("customs_agent_id");

-- CreateIndex
CREATE INDEX "quotation_created_at_idx" ON "quotation"("created_at");

-- CreateIndex
CREATE INDEX "quotation_reference_number_idx" ON "quotation"("reference_number");

-- CreateIndex
CREATE INDEX "quotation_product_quotation_id_idx" ON "quotation_product"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_product_product_id_idx" ON "quotation_product"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_product_quotation_id_product_id_key" ON "quotation_product"("quotation_id", "product_id");

-- CreateIndex
CREATE INDEX "quotation_cost_detail_quotation_id_category_idx" ON "quotation_cost_detail"("quotation_id", "category");

-- CreateIndex
CREATE INDEX "quotation_cost_detail_quotation_id_sort_order_idx" ON "quotation_cost_detail"("quotation_id", "sort_order");

-- CreateIndex
CREATE INDEX "audit_state_change_quotation_id_changed_at_idx" ON "audit_state_change"("quotation_id", "changed_at");

-- CreateIndex
CREATE INDEX "audit_state_change_changed_by_changed_at_idx" ON "audit_state_change"("changed_by", "changed_at");

-- CreateIndex
CREATE INDEX "audit_data_change_quotation_id_changed_at_idx" ON "audit_data_change"("quotation_id", "changed_at");

-- CreateIndex
CREATE INDEX "audit_data_change_quotation_id_field_name_idx" ON "audit_data_change"("quotation_id", "field_name");

-- CreateIndex
CREATE INDEX "audit_data_change_changed_by_changed_at_idx" ON "audit_data_change"("changed_by", "changed_at");

-- CreateIndex
CREATE INDEX "quotation_document_quotation_id_idx" ON "quotation_document"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_document_uploaded_by_idx" ON "quotation_document"("uploaded_by");

-- AddForeignKey
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country" ADD CONSTRAINT "country_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_from_currency_id_fkey" FOREIGN KEY ("from_currency_id") REFERENCES "currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_to_currency_id_fkey" FOREIGN KEY ("to_currency_id") REFERENCES "currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidator_tariff" ADD CONSTRAINT "consolidator_tariff_consolidator_id_fkey" FOREIGN KEY ("consolidator_id") REFERENCES "consolidator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidator_tariff" ADD CONSTRAINT "consolidator_tariff_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidator_tariff_component" ADD CONSTRAINT "consolidator_tariff_component_consolidator_tariff_id_fkey" FOREIGN KEY ("consolidator_tariff_id") REFERENCES "consolidator_tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_agent_tariff" ADD CONSTRAINT "customs_agent_tariff_customs_agent_id_fkey" FOREIGN KEY ("customs_agent_id") REFERENCES "customs_agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_agent_tariff" ADD CONSTRAINT "customs_agent_tariff_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_agent_tariff_component" ADD CONSTRAINT "customs_agent_tariff_component_customs_agent_tariff_id_fkey" FOREIGN KEY ("customs_agent_tariff_id") REFERENCES "customs_agent_tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_consolidator_id_fkey" FOREIGN KEY ("consolidator_id") REFERENCES "consolidator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_customs_agent_id_fkey" FOREIGN KEY ("customs_agent_id") REFERENCES "customs_agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_consolidator_tariff_id_fkey" FOREIGN KEY ("consolidator_tariff_id") REFERENCES "consolidator_tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_customs_agent_tariff_id_fkey" FOREIGN KEY ("customs_agent_tariff_id") REFERENCES "customs_agent_tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_product" ADD CONSTRAINT "quotation_product_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_product" ADD CONSTRAINT "quotation_product_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_cost_detail" ADD CONSTRAINT "quotation_cost_detail_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_state_change" ADD CONSTRAINT "audit_state_change_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_state_change" ADD CONSTRAINT "audit_state_change_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_data_change" ADD CONSTRAINT "audit_data_change_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_data_change" ADD CONSTRAINT "audit_data_change_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_document" ADD CONSTRAINT "quotation_document_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_document" ADD CONSTRAINT "quotation_document_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
