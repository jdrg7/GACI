import type {
  ConsolidatorTariffComponent,
  CustomsAgentTariffComponent,
  CostCategory,
} from '@prisma/client'

export interface ComponentBasis {
  weightKg: number
  weightLb: number
  volumeCft: number
  /** CIF en USD (siempre calculado antes de resolver componentes PER_VALUE/RANGE_VALUE) */
  cifUsd: number
}

export interface ComponentCalculationResult {
  original_amount: number
  original_currency: string
  exchange_rate: number | null
  amount_usd: number
  calculation_basis: 'KG' | 'LB' | 'CFT' | 'CIF_USD' | 'CIF_HNL' | null
  basis_value: number | null
  calculation_snapshot: Record<string, unknown>
}

export type TariffComponentLike = (ConsolidatorTariffComponent | CustomsAgentTariffComponent) & {
  currencyCode: string
}

export interface QuotationProductInput {
  product_id: string
  quantity: number
  weight_kg_used: number
  weight_lb_used: number
  volume_cft_used: number
  fob_unit_price: number
  fob_total: number
}

export interface EngineInput {
  products: QuotationProductInput[]
  otherInternationalCosts: number
  marginAmount: number
  exchangeRateUsdToHnl: number
  consolidatorComponents: TariffComponentLike[]
  customsAgentComponents: TariffComponentLike[]
}

export interface CostDetailLine extends ComponentCalculationResult {
  category: CostCategory
  component_name: string
  sort_order: number
  consolidator_tariff_component_id: string | null
  customs_agent_tariff_component_id: string | null
  // Impuesto de paso (ej. ISV): se muestra en el desglose y alimenta el % de
  // nacionalización, pero no se suma al total_cost. Siempre false para
  // componentes de consolidador (el campo solo existe en CustomsAgentTariffComponent).
  is_tax: boolean
}

export interface EngineResult {
  total_weight_kg: number
  total_weight_lb: number
  total_volume_cft: number
  fob: number
  insurance: number
  other_international_costs: number
  subtotal_consolidator: number
  cif: number
  subtotal_customs_agent: number
  total_cost: number
  margin_amount: number
  margin_percentage: number
  sale_price: number
  nationalization_base: number
  nationalization_percentage: number
  cost_details: CostDetailLine[]
}
