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
): { total: number; taxTotal: number; lines: CostDetailLine[] } {
  let total = 0
  let taxTotal = 0
  const lines: CostDetailLine[] = []

  for (const component of components) {
    const result = calculateComponent(component, basis, exchangeRate)
    const isTax = 'is_tax' in component && component.is_tax === true
    total = round(total + result.amount_usd, 4)
    if (isTax) taxTotal = round(taxTotal + result.amount_usd, 4)
    lines.push({
      ...result,
      category,
      component_name: component.name,
      sort_order: component.sort_order,
      consolidator_tariff_component_id: isConsolidatorComponent(component) ? component.id : null,
      customs_agent_tariff_component_id: isConsolidatorComponent(component) ? null : component.id,
      is_tax: isTax,
    })
  }

  return { total, taxTotal, lines }
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
  costDetails: { category: CostCategory; amount_usd: number; is_tax?: boolean }[],
): RecomputedTotals {
  const sumBy = (category: CostCategory): number =>
    round(
      costDetails.filter((c) => c.category === category).reduce((sum, c) => sum + c.amount_usd, 0),
      4,
    )

  const insurance = sumBy(CostCategory.INSURANCE)
  const otherInternationalCosts = sumBy(CostCategory.OTHER_INTERNATIONAL)
  const subtotalConsolidator = sumBy(CostCategory.CONSOLIDATOR)
  // Total del agente incluyendo el ISV (u otro is_tax) — se usa solo para el % de
  // nacionalización, que sigue basándose en el costo completo que cobra el agente.
  const agentTotalWithTax = sumBy(CostCategory.CUSTOMS_AGENT)
  // Impuestos de paso (ej. ISV): se muestran en el desglose pero no se suman ni al
  // subtotal del agente aduanero ni al total_cost.
  const taxAmount = round(
    costDetails
      .filter((c) => c.category === CostCategory.CUSTOMS_AGENT && c.is_tax === true)
      .reduce((sum, c) => sum + c.amount_usd, 0),
    4,
  )
  const subtotalCustomsAgent = round(agentTotalWithTax - taxAmount, 4)

  // El CIF (FOB + Seguro + Otros costos internacionales + Flete) es solo la base
  // para calcular el ISV y el % de nacionalización — no aporta nada al costo
  // total, que es el costo real del servicio: flete/consolidador + agente aduanero.
  const cif = round(fob + subtotalConsolidator + insurance + otherInternationalCosts, 4)
  const totalCost = round(subtotalConsolidator + subtotalCustomsAgent, 4)
  const salePrice = round(totalCost + marginAmount, 4)
  const marginPercentage = totalCost > 0 ? round((marginAmount / totalCost) * 100, 4) : 0
  const nationalizationBase = round(fob + subtotalConsolidator, 4)
  const nationalizationPercentage =
    nationalizationBase > 0 ? round((agentTotalWithTax / nationalizationBase) * 100, 4) : 0

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
    is_tax: false,
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
          is_tax: false,
        }
      : null

  // El ISV (u otro componente marcado is_tax) se calcula sobre el CIF y se
  // muestra en el desglose, pero no se suma al subtotal del agente aduanero.
  // El CIF (FOB + Seguro + Otros costos internacionales + Flete) tampoco aporta
  // nada al costo total — solo sirve de base para calcular ese impuesto y el %
  // de nacionalización. El costo total real del servicio es flete/consolidador
  // + agente aduanero (sin impuesto).
  const agentSubtotalWithoutTax = round(agentResult.total - agentResult.taxTotal, 4)
  const totalCost = round(consolidatorResult.total + agentSubtotalWithoutTax, 4)
  const salePrice = round(totalCost + input.marginAmount, 4)
  const marginPercentage = totalCost > 0 ? round((input.marginAmount / totalCost) * 100, 4) : 0

  const nationalizationBase = round(fob + consolidatorResult.total, 4)
  // El % de nacionalización sigue basándose en el costo completo que cobra el
  // agente (incluyendo el ISV), no en el subtotal ya neto de impuesto.
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
    subtotal_customs_agent: agentSubtotalWithoutTax,
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
