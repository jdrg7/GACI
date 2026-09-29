import { CostCategory } from '@prisma/client'
import { round } from '../../shared/utils/round'
import { calculateComponent } from './component-calculator'
import { calculateInsurance } from './insurance.calculator'
import type { ComponentBasis, CostDetailLine, EngineInput, EngineResult, TariffComponentLike } from './types'

function isConsolidatorComponent(
  component: TariffComponentLike,
): component is TariffComponentLike & { consolidator_tariff_id: string } {
  return 'consolidator_tariff_id' in component
}

function calculateComponents(
  components: TariffComponentLike[],
  category: CostCategory,
  basis: ComponentBasis,
  exchangeRate: number,
): { total: number; lines: CostDetailLine[] } {
  let total = 0
  const lines: CostDetailLine[] = []

  for (const component of components) {
    const result = calculateComponent(component, basis, exchangeRate)
    total = round(total + result.amount_usd, 4)
    lines.push({
      ...result,
      category,
      component_name: component.name,
      sort_order: component.sort_order,
      consolidator_tariff_component_id: isConsolidatorComponent(component) ? component.id : null,
      customs_agent_tariff_component_id: isConsolidatorComponent(component) ? null : component.id,
    })
  }

  return { total, lines }
}

export interface RecomputedTotals {
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
}

/**
 * Recalcula los totales agregados de una cotización a partir de las líneas de
 * `QuotationCostDetail` YA GUARDADAS (usa su `amount_usd` tal cual, incluyendo
 * cualquier `is_manual_override`) — no vuelve a leer tarifas ni a recalcular
 * cada componente. Se usa cuando alguien sobreescribe manualmente una línea:
 * los demás componentes no cambian, solo hay que sumar de nuevo.
 */
export function recomputeTotalsFromCostDetails(
  fob: number,
  marginAmount: number,
  costDetails: { category: CostCategory; amount_usd: number }[],
): RecomputedTotals {
  const sumBy = (category: CostCategory): number =>
    round(
      costDetails.filter((c) => c.category === category).reduce((sum, c) => sum + c.amount_usd, 0),
      4,
    )

  const insurance = sumBy(CostCategory.INSURANCE)
  const otherInternationalCosts = sumBy(CostCategory.OTHER_INTERNATIONAL)
  const subtotalConsolidator = sumBy(CostCategory.CONSOLIDATOR)
  const subtotalCustomsAgent = sumBy(CostCategory.CUSTOMS_AGENT)

  const cif = round(fob + subtotalConsolidator + insurance + otherInternationalCosts, 4)
  const totalCost = round(cif + subtotalCustomsAgent, 4)
  const salePrice = round(totalCost + marginAmount, 4)
  const marginPercentage = totalCost > 0 ? round((marginAmount / totalCost) * 100, 4) : 0
  const nationalizationBase = round(fob + subtotalConsolidator, 4)
  const nationalizationPercentage =
    nationalizationBase > 0 ? round((subtotalCustomsAgent / nationalizationBase) * 100, 4) : 0

  return {
    fob: round(fob, 4),
    insurance,
    other_international_costs: otherInternationalCosts,
    subtotal_consolidator: subtotalConsolidator,
    cif,
    subtotal_customs_agent: subtotalCustomsAgent,
    total_cost: totalCost,
    margin_amount: round(marginAmount, 4),
    margin_percentage: marginPercentage,
    sale_price: salePrice,
    nationalization_base: nationalizationBase,
    nationalization_percentage: nationalizationPercentage,
  }
}

export function calculateQuotation(input: EngineInput): EngineResult {
  const totalWeightKg = round(
    input.products.reduce((sum, p) => sum + p.weight_kg_used, 0),
    3,
  )
  const totalWeightLb = round(
    input.products.reduce((sum, p) => sum + p.weight_lb_used, 0),
    3,
  )
  const totalVolumeCft = round(
    input.products.reduce((sum, p) => sum + p.volume_cft_used, 0),
    3,
  )
  const fob = round(
    input.products.reduce((sum, p) => sum + p.fob_total, 0),
    4,
  )

  const insurance = calculateInsurance(fob)

  // Primera pasada: se necesita subtotal_consolidator antes de poder calcular
  // los componentes del agente basados en CIF (ISV, Honorarios, Manejo de Mercadería).
  const basisForConsolidator: ComponentBasis = {
    weightKg: totalWeightKg,
    weightLb: totalWeightLb,
    volumeCft: totalVolumeCft,
    cifUsd: 0, // el consolidador nunca calcula sobre CIF
  }
  const consolidatorResult = calculateComponents(
    input.consolidatorComponents,
    CostCategory.CONSOLIDATOR,
    basisForConsolidator,
    input.exchangeRateUsdToHnl,
  )

  const cif = round(fob + consolidatorResult.total + insurance + input.otherInternationalCosts, 4)

  const basisForAgent: ComponentBasis = {
    weightKg: totalWeightKg,
    weightLb: totalWeightLb,
    volumeCft: totalVolumeCft,
    cifUsd: cif,
  }
  const agentResult = calculateComponents(
    input.customsAgentComponents,
    CostCategory.CUSTOMS_AGENT,
    basisForAgent,
    input.exchangeRateUsdToHnl,
  )

  const insuranceLine: CostDetailLine = {
    original_amount: insurance,
    original_currency: 'USD',
    exchange_rate: null,
    amount_usd: insurance,
    calculation_basis: null,
    basis_value: fob,
    calculation_snapshot: { type: 'INSURANCE', fob, rate: 0.0035, result: insurance },
    category: CostCategory.INSURANCE,
    component_name: 'Seguro',
    sort_order: -1,
    consolidator_tariff_component_id: null,
    customs_agent_tariff_component_id: null,
  }

  const otherCostsLine: CostDetailLine | null =
    input.otherInternationalCosts > 0
      ? {
          original_amount: round(input.otherInternationalCosts, 4),
          original_currency: 'USD',
          exchange_rate: null,
          amount_usd: round(input.otherInternationalCosts, 4),
          calculation_basis: null,
          basis_value: null,
          calculation_snapshot: { type: 'OTHER_INTERNATIONAL', result: input.otherInternationalCosts },
          category: CostCategory.OTHER_INTERNATIONAL,
          component_name: 'Otros gastos internacionales',
          sort_order: -1,
          consolidator_tariff_component_id: null,
          customs_agent_tariff_component_id: null,
        }
      : null

  const totalCost = round(cif + agentResult.total, 4)
  const salePrice = round(totalCost + input.marginAmount, 4)
  const marginPercentage = totalCost > 0 ? round((input.marginAmount / totalCost) * 100, 4) : 0

  const nationalizationBase = round(fob + consolidatorResult.total, 4)
  const nationalizationPercentage =
    nationalizationBase > 0 ? round((agentResult.total / nationalizationBase) * 100, 4) : 0

  return {
    total_weight_kg: totalWeightKg,
    total_weight_lb: totalWeightLb,
    total_volume_cft: totalVolumeCft,
    fob,
    insurance,
    other_international_costs: round(input.otherInternationalCosts, 4),
    subtotal_consolidator: consolidatorResult.total,
    cif,
    subtotal_customs_agent: agentResult.total,
    total_cost: totalCost,
    margin_amount: round(input.marginAmount, 4),
    margin_percentage: marginPercentage,
    sale_price: salePrice,
    nationalization_base: nationalizationBase,
    nationalization_percentage: nationalizationPercentage,
    cost_details: [
      ...consolidatorResult.lines,
      insuranceLine,
      ...(otherCostsLine ? [otherCostsLine] : []),
      ...agentResult.lines,
    ],
  }
}
