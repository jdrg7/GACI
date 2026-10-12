import {
  Prisma,
  TransportType,
  type ConsolidatorTariff,
  type ConsolidatorTariffComponent,
  type ServiceLevel,
} from '@prisma/client'
import { calculateQuotation } from '../calculation-engine/engine.service'
import type {
  CostDetailLine,
  EngineResult,
  QuotationProductInput,
  TariffComponentLike,
} from '../calculation-engine/types'

export type TariffWithComponents = ConsolidatorTariff & { components: ConsolidatorTariffComponent[] }

// Los 9 totales que cada escenario guarda por separado (todo lo demás — FOB, seguro,
// pesos — es igual en todos los modos).
export interface ScenarioTotals {
  subtotal_consolidator: number
  cif: number
  subtotal_customs_agent: number
  total_cost: number
  margin_amount: number
  margin_percentage: number
  sale_price: number
  nationalization_base: number
  nationalization_percentage: number
}

export type LineToPersist = CostDetailLine & {
  is_manual_override?: boolean
  override_reason?: string | null
}

export interface ScenarioResult {
  transport_type: TransportType
  consolidator_tariff_id: string
  result: EngineResult
  totals: ScenarioTotals
  lines: LineToPersist[]
}

export interface ScenarioCalcInput {
  products: QuotationProductInput[]
  marginAmount: number
  otherInternationalCosts: number
  exchangeRateUsdToHnl: number
  serviceLevel: ServiceLevel
  customsAgentComponents: TariffComponentLike[]
  toComponentLike: (component: ConsolidatorTariffComponent) => TariffComponentLike
}

export function totalsOf(result: EngineResult): ScenarioTotals {
  return {
    subtotal_consolidator: result.subtotal_consolidator,
    cif: result.cif,
    subtotal_customs_agent: result.subtotal_customs_agent,
    total_cost: result.total_cost,
    margin_amount: result.margin_amount,
    margin_percentage: result.margin_percentage,
    sale_price: result.sale_price,
    nationalization_base: result.nationalization_base,
    nationalization_percentage: result.nationalization_percentage,
  }
}

// Calcula un modo de transporte completo (consolidador + agente) con su propia tarifa.
// El CIF cambia con el flete, así que el lado del agente se recalcula por escenario.
export function calculateScenario(tariff: TariffWithComponents, input: ScenarioCalcInput): ScenarioResult {
  const result = calculateQuotation({
    products: input.products,
    otherInternationalCosts: input.otherInternationalCosts,
    marginAmount: input.marginAmount,
    exchangeRateUsdToHnl: input.exchangeRateUsdToHnl,
    consolidatorComponents: tariff.components.map(input.toComponentLike),
    customsAgentComponents: input.customsAgentComponents,
    serviceLevel: input.serviceLevel,
    volumetricDivisor: Number(tariff.volumetric_divisor),
  })

  return {
    transport_type: tariff.transport_type,
    consolidator_tariff_id: tariff.id,
    result,
    totals: totalsOf(result),
    lines: result.cost_details,
  }
}

const MODE_ORDER: TransportType[] = [TransportType.AEREO, TransportType.MARITIMO]

// El más barato por costo total; ante empate, el primero en MODE_ORDER (aéreo).
export function cheapestOf<T>(items: T[], totalCost: (item: T) => number, mode: (item: T) => TransportType): T {
  const sorted = [...items].sort(
    (a, b) => totalCost(a) - totalCost(b) || MODE_ORDER.indexOf(mode(a)) - MODE_ORDER.indexOf(mode(b)),
  )
  const first = sorted[0]
  if (!first) throw new Error('No hay escenarios para elegir')
  return first
}

export function scenarioRowData(
  quotationId: string,
  scenario: ScenarioResult,
): Prisma.QuotationScenarioUncheckedCreateInput {
  return {
    quotation_id: quotationId,
    transport_type: scenario.transport_type,
    consolidator_tariff_id: scenario.consolidator_tariff_id,
    volumetric_weight_lb: scenario.result.volumetric_weight_lb,
    chargeable_weight_kg: scenario.result.chargeable_weight_kg,
    ...scenario.totals,
  }
}

export function costDetailRows(
  quotationId: string,
  scenarioId: string,
  lines: LineToPersist[],
): Prisma.QuotationCostDetailCreateManyInput[] {
  return lines.map((line) => ({
    ...line,
    quotation_id: quotationId,
    scenario_id: scenarioId,
    calculation_snapshot: line.calculation_snapshot as Prisma.InputJsonValue,
  }))
}
