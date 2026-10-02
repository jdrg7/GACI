import { describe, expect, it } from 'vitest'
import { CalculationType, TariffBasis } from '@prisma/client'
import { calculateQuotation, recomputeTotalsFromCostDetails } from './engine.service'
import type { QuotationProductInput, TariffComponentLike } from './types'

// Fixtures: copia exacta de los componentes sembrados en prisma/seed.ts
// (PFI Aéreo/Marítimo Honduras 2026 + Agente Aduanero Base Honduras 2026).

function comp(overrides: Record<string, unknown>): TariffComponentLike {
  return {
    id: overrides.id ?? 'comp',
    name: overrides.name ?? 'comp',
    calculation_type: CalculationType.FIXED,
    currencyCode: 'USD',
    currency_id: 'x',
    fixed_amount: null,
    rate_per_unit: null,
    rate_percentage: null,
    minimum_amount: null,
    maximum_amount: null,
    tariff_ranges: null,
    basis_unit: null,
    sort_order: 0,
    notes: null,
    ...overrides,
  } as unknown as TariffComponentLike
}

const AEREO_CONSOLIDATOR_COMPONENTS: TariffComponentLike[] = [
  comp({
    id: 'air-freight',
    name: 'Air Freight',
    calculation_type: CalculationType.RANGE_KG,
    tariff_ranges: [
      { from: 0, to: 50, type: 'fixed', amount: 210 },
      { from: 50, to: null, type: 'base_plus', base: 210, rate: 1.85, base_from: 50 },
    ],
  }),
  comp({
    id: 'fuel-surcharge',
    name: 'Fuel Surcharge',
    calculation_type: CalculationType.RANGE_KG,
    tariff_ranges: [
      { from: 0, to: 50, type: 'fixed', amount: 50 },
      { from: 50, to: null, type: 'base_plus', base: 50, rate: 0.55, base_from: 50 },
    ],
  }),
  comp({
    id: 'security-surcharge',
    name: 'Security Surcharge',
    calculation_type: CalculationType.MAX_OF,
    rate_per_unit: 0.15,
    minimum_amount: 40,
    basis_unit: TariffBasis.KG,
  }),
  comp({
    id: 'screening-fee',
    name: 'Screening Fee',
    calculation_type: CalculationType.MAX_OF,
    rate_per_unit: 0.12,
    minimum_amount: 10,
    basis_unit: TariffBasis.KG,
  }),
  comp({
    id: 'delivery',
    name: 'Delivery',
    calculation_type: CalculationType.MAX_OF,
    rate_per_unit: 0.06,
    minimum_amount: 75,
    basis_unit: TariffBasis.LB,
  }),
  comp({ id: 'forwarding-fee', name: 'Forwarding Fee', calculation_type: CalculationType.FIXED, fixed_amount: 50 }),
  comp({ id: 'tsa-fee', name: 'TSA Maintenance Fee', calculation_type: CalculationType.FIXED, fixed_amount: 55 }),
  comp({ id: 'accessorial', name: 'Accessorial', calculation_type: CalculationType.FIXED, fixed_amount: 25 }),
]

const MARITIMO_CONSOLIDATOR_COMPONENTS: TariffComponentLike[] = [
  comp({
    id: 'ocean-freight',
    name: 'Ocean Freight',
    calculation_type: CalculationType.MAX_OF,
    rate_per_unit: 3.0,
    minimum_amount: 175,
    basis_unit: TariffBasis.CFT,
  }),
  comp({
    id: 'bunker',
    name: 'Bunker',
    calculation_type: CalculationType.MAX_OF,
    rate_per_unit: 1.37,
    minimum_amount: 75,
    basis_unit: TariffBasis.CFT,
  }),
  comp({
    id: 'security',
    name: 'Security',
    calculation_type: CalculationType.MAX_OF,
    rate_per_unit: 0.14,
    minimum_amount: 50,
    basis_unit: TariffBasis.CFT,
  }),
  comp({ id: 'bl-fee', name: 'B/L Fee', calculation_type: CalculationType.FIXED, fixed_amount: 20 }),
  comp({ id: 'forwarding-fee-m', name: 'Forwarding Fee', calculation_type: CalculationType.FIXED, fixed_amount: 85 }),
  comp({ id: 'accessorial-m', name: 'Accessorial', calculation_type: CalculationType.FIXED, fixed_amount: 25 }),
  comp({
    id: 'pick-up-delivery',
    name: 'Pick Up & Delivery',
    calculation_type: CalculationType.RANGE_LB,
    tariff_ranges: [
      { from: 0, to: 1250, type: 'fixed', amount: 75 },
      { from: 1250, to: 2083, type: 'fixed', amount: 125 },
      { from: 2083, to: null, type: 'base_plus', base: 125, rate: 0.06, base_from: 2083 },
    ],
  }),
]

const HONORARIOS_RANGES = [
  { from: 0, to: 1500, type: 'fixed' as const, amount: 1000 },
  { from: 1500, to: 4000, type: 'per_value' as const, rate: 0.05, min: 125 },
  { from: 4000, to: 24000, type: 'per_value' as const, rate: 0.03, min: 600 },
  { from: 24000, to: 64000, type: 'per_value' as const, rate: 0.015, min: 600 },
  { from: 64000, to: 124000, type: 'per_value' as const, rate: 0.01, min: 600 },
  { from: 124000, to: 200000, type: 'per_value' as const, rate: 0.006, min: 456 },
  { from: 200000, to: null, type: 'per_value' as const, rate: 0.005 },
]

const AGENT_COMPONENTS: TariffComponentLike[] = [
  comp({ id: 'deva', name: 'Declaración DEVA', calculation_type: CalculationType.FIXED, currencyCode: 'HNL', fixed_amount: 335.02 }),
  comp({ id: 'transmision', name: 'Transmisión Electrónica Digital', calculation_type: CalculationType.FIXED, currencyCode: 'HNL', fixed_amount: 450 }),
  comp({ id: 'papeleria', name: 'Papelería', calculation_type: CalculationType.FIXED, currencyCode: 'HNL', fixed_amount: 100 }),
  comp({ id: 'examen', name: 'Examen Preliminar', calculation_type: CalculationType.FIXED, currencyCode: 'HNL', fixed_amount: 500 }),
  comp({ id: 'fotocopias', name: 'Fotocopias', calculation_type: CalculationType.FIXED, currencyCode: 'HNL', fixed_amount: 100 }),
  comp({ id: 'duca', name: 'Llenado de DUCA', calculation_type: CalculationType.FIXED, currencyCode: 'HNL', fixed_amount: 650 }),
  comp({ id: 'di', name: 'Llenado de DI', calculation_type: CalculationType.FIXED, currencyCode: 'HNL', fixed_amount: 500 }),
  comp({
    id: 'supervision',
    name: 'Supervisión y Registro Aduanal',
    calculation_type: CalculationType.RANGE_KG,
    currencyCode: 'HNL',
    tariff_ranges: [
      { from: 0, to: 50, type: 'fixed', amount: 200 },
      { from: 50, to: 550, type: 'per_unit', rate: 0.08 },
      { from: 550, to: 1550, type: 'per_unit', rate: 0.06 },
      { from: 1550, to: 6550, type: 'per_unit', rate: 0.05 },
      { from: 6550, to: null, type: 'per_unit', rate: 0.05 },
    ],
  }),
  comp({ id: 'manejo', name: 'Manejo de Mercadería', calculation_type: CalculationType.RANGE_VALUE, currencyCode: 'HNL', tariff_ranges: HONORARIOS_RANGES }),
  comp({ id: 'honorarios', name: 'Honorarios Profesionales', calculation_type: CalculationType.RANGE_VALUE, currencyCode: 'HNL', tariff_ranges: HONORARIOS_RANGES }),
  comp({
    id: 'almacenaje',
    name: 'Almacenaje',
    calculation_type: CalculationType.RANGE_KG,
    currencyCode: 'HNL',
    tariff_ranges: [
      { from: 0, to: 50, type: 'fixed', amount: 1400 },
      { from: 50, to: null, type: 'base_plus', base: 1400, rate: 50, base_from: 50 },
    ],
  }),
  comp({
    id: 'flete',
    name: 'Flete Terrestre',
    calculation_type: CalculationType.RANGE_KG,
    currencyCode: 'HNL',
    tariff_ranges: [
      { from: 0, to: 300, type: 'fixed', amount: 1200 },
      { from: 300, to: null, type: 'block_ceil', base: 1200, rate: 50, block_size: 10, base_from: 300 },
    ],
  }),
  comp({ id: 'isv', name: 'ISV', calculation_type: CalculationType.PER_VALUE, currencyCode: 'USD', rate_percentage: 0.15, is_tax: true }),
]

function product(overrides: Partial<QuotationProductInput>): QuotationProductInput {
  return {
    product_id: overrides.product_id ?? 'p',
    quantity: 1,
    weight_kg_used: 0,
    weight_lb_used: 0,
    volume_cft_used: 0,
    fob_unit_price: 0,
    fob_total: 0,
    ...overrides,
  }
}

describe('calculateQuotation — escenario aéreo (caso de negocio verificado en schema.prisma)', () => {
  // FOB elegido para que CIF dé exactamente $13,035 con subtotal_consolidator=$1,146
  // (300 KG) e insurance=FOB×0.35% — despejado algebraicamente: FOB×1.0035 = 13035-1146.
  const FOB = 11847.5336

  const result = calculateQuotation({
    products: [
      product({ product_id: 'p1', weight_kg_used: 300, weight_lb_used: 661.386, volume_cft_used: 10, fob_unit_price: FOB, fob_total: FOB }),
    ],
    otherInternationalCosts: 0,
    marginAmount: 0,
    exchangeRateUsdToHnl: 27.004,
    consolidatorComponents: AEREO_CONSOLIDATOR_COMPONENTS,
    customsAgentComponents: AGENT_COMPONENTS,
  })

  it('subtotal_consolidator = $1,146 (Air Freight 672.50 + Fuel 187.50 + Security 45 + Screening 36 + Delivery 75 + 50 + 55 + 25)', () => {
    expect(result.subtotal_consolidator).toBe(1146)
  })

  it('CIF ≈ $13,035', () => {
    expect(result.cif).toBeCloseTo(13035, 2)
  })

  it('ISV = CIF_USD × 15% = $1,955.25 exacto', () => {
    const isv = result.cost_details.find((c) => c.component_name === 'ISV')
    expect(isv?.original_amount).toBe(1955.25)
    expect(isv?.amount_usd).toBe(1955.25)
    expect(isv?.calculation_basis).toBe('CIF_USD')
  })

  it('Supervisión y Registro Aduanal = L220 (verificado)', () => {
    const supervision = result.cost_details.find((c) => c.component_name === 'Supervisión y Registro Aduanal')
    expect(supervision?.original_amount).toBe(220)
    expect(supervision?.original_currency).toBe('HNL')
  })

  it('Honorarios Profesionales y Manejo de Mercadería = L4,140.9857 cada uno (verificado)', () => {
    const honorarios = result.cost_details.find((c) => c.component_name === 'Honorarios Profesionales')
    const manejo = result.cost_details.find((c) => c.component_name === 'Manejo de Mercadería')
    expect(honorarios?.original_amount).toBeCloseTo(4140.9857, 4)
    expect(manejo?.original_amount).toBeCloseTo(4140.9857, 4)
  })

  it('incluye una línea de costo INSURANCE calculada inline (FOB × 0.35%)', () => {
    const insurance = result.cost_details.find((c) => c.category === 'INSURANCE')
    expect(insurance?.amount_usd).toBeCloseTo(result.insurance, 4)
  })

  it('ISV está marcado is_tax: se muestra en el desglose pero no se suma al subtotal del agente ni al costo total', () => {
    const isv = result.cost_details.find((c) => c.component_name === 'ISV')!
    expect(isv.is_tax).toBe(true)
  })

  it('subtotal_customs_agent excluye el ISV (impuesto de solo visualización)', () => {
    const agentLines = result.cost_details.filter((c) => c.category === 'CUSTOMS_AGENT')
    const agentTotalWithTax = agentLines.reduce((sum, c) => sum + c.amount_usd, 0)
    const isv = agentLines.find((c) => c.component_name === 'ISV')!
    expect(result.subtotal_customs_agent).toBeCloseTo(agentTotalWithTax - isv.amount_usd, 4)
  })

  it('consistencia interna: total_cost = subtotal_consolidator + subtotal_customs_agent (el CIF no aporta nada al total)', () => {
    expect(result.total_cost).toBeCloseTo(result.subtotal_consolidator + result.subtotal_customs_agent, 4)
  })

  it('el CIF no aporta nada al costo total: costo total NO incluye FOB, Seguro ni Otros costos internacionales', () => {
    expect(result.total_cost).not.toBeCloseTo(result.cif + result.subtotal_customs_agent, 4)
  })

  it('consistencia interna: nationalization_base = FOB + subtotal_consolidator (NO el CIF completo)', () => {
    expect(result.nationalization_base).toBeCloseTo(result.fob + result.subtotal_consolidator, 4)
  })

  it('consistencia interna: nationalization_percentage se basa en el costo completo del agente (incluyendo ISV)', () => {
    const agentTotalWithTax = result.cost_details
      .filter((c) => c.category === 'CUSTOMS_AGENT')
      .reduce((sum, c) => sum + c.amount_usd, 0)
    expect(result.nationalization_percentage).toBeCloseTo((agentTotalWithTax / result.nationalization_base) * 100, 4)
  })
})

describe('calculateQuotation — escenario marítimo (nunca probado antes end-to-end)', () => {
  // 500 KG → 1,102.31 LB (tramo 1 de Pick Up & Delivery, ≤1,250 LB → $75 flat)
  // 10 CFT → todos los MAX_OF marítimos caen en su mínimo (volumen bajo)
  const result = calculateQuotation({
    products: [
      product({ product_id: 'p1', weight_kg_used: 500, weight_lb_used: 1102.31, volume_cft_used: 10, fob_unit_price: 5000, fob_total: 5000 }),
    ],
    otherInternationalCosts: 0,
    marginAmount: 0,
    exchangeRateUsdToHnl: 27.004,
    consolidatorComponents: MARITIMO_CONSOLIDATOR_COMPONENTS,
    customsAgentComponents: AGENT_COMPONENTS,
  })

  it('Ocean Freight/Bunker/Security caen en su mínimo con 10 CFT (175 + 75 + 50)', () => {
    const ocean = result.cost_details.find((c) => c.component_name === 'Ocean Freight')
    const bunker = result.cost_details.find((c) => c.component_name === 'Bunker')
    const security = result.cost_details.find((c) => c.component_name === 'Security')
    expect(ocean?.original_amount).toBe(175)
    expect(bunker?.original_amount).toBe(75)
    expect(security?.original_amount).toBe(50)
  })

  it('Pick Up & Delivery usa LB (RANGE_LB), no KG: 1,102.31 LB → tramo 1 fijo $75', () => {
    const pickUp = result.cost_details.find((c) => c.component_name === 'Pick Up & Delivery')
    expect(pickUp?.original_amount).toBe(75)
    expect(pickUp?.calculation_basis).toBe('LB')
    expect(pickUp?.basis_value).toBeCloseTo(1102.31, 2)
  })

  it('subtotal_consolidator = 175+75+50+20+85+25+75 = $505', () => {
    expect(result.subtotal_consolidator).toBe(505)
  })

  it('los componentes del agente (basados en KG=500, no en el escenario aéreo de 300 KG) dan otro resultado', () => {
    const supervision = result.cost_details.find((c) => c.component_name === 'Supervisión y Registro Aduanal')
    // 500 KG: tramo [50,550) per_unit 0.08 → 200 + (500-50)×0.08 = 200+36 = 236
    expect(supervision?.original_amount).toBe(236)
  })
})

describe('calculateQuotation — multi-producto', () => {
  const result = calculateQuotation({
    products: [
      product({ product_id: 'p1', weight_kg_used: 100, weight_lb_used: 220.462, volume_cft_used: 4, fob_unit_price: 2000, fob_total: 2000 }),
      product({ product_id: 'p2', weight_kg_used: 200, weight_lb_used: 440.924, volume_cft_used: 6, fob_unit_price: 3000, fob_total: 3000 }),
    ],
    otherInternationalCosts: 50,
    marginAmount: 500,
    exchangeRateUsdToHnl: 27.004,
    consolidatorComponents: AEREO_CONSOLIDATOR_COMPONENTS,
    customsAgentComponents: AGENT_COMPONENTS,
  })

  it('suma los pesos/volúmenes/FOB de todos los productos (100+200 KG, $2000+$3000 FOB)', () => {
    expect(result.total_weight_kg).toBe(300)
    expect(result.fob).toBe(5000)
  })

  it('el motor calcula sobre el TOTAL agregado, igual que con un solo producto de 300 KG', () => {
    // Air Freight sobre 300 KG total (no por línea): 210 + (300-50)×1.85 = 672.5
    const airFreight = result.cost_details.find((c) => c.component_name === 'Air Freight')
    expect(airFreight?.original_amount).toBe(672.5)
  })

  it('other_international_costs y margin_amount se reflejan en CIF y sale_price', () => {
    expect(result.other_international_costs).toBe(50)
    expect(result.margin_amount).toBe(500)
    expect(result.sale_price).toBeCloseTo(result.total_cost + 500, 4)
  })
})

describe('recomputeTotalsFromCostDetails — usado al sobreescribir manualmente una línea (is_manual_override)', () => {
  const engineResult = calculateQuotation({
    products: [
      product({ product_id: 'p1', weight_kg_used: 300, weight_lb_used: 661.386, volume_cft_used: 10, fob_unit_price: 11847.5336, fob_total: 11847.5336 }),
    ],
    otherInternationalCosts: 0,
    marginAmount: 1000,
    exchangeRateUsdToHnl: 27.004,
    consolidatorComponents: AEREO_CONSOLIDATOR_COMPONENTS,
    customsAgentComponents: AGENT_COMPONENTS,
  })

  it('sin ningún override, reproduce exactamente los mismos totales que calculateQuotation', () => {
    const totals = recomputeTotalsFromCostDetails(
      engineResult.fob,
      engineResult.margin_amount,
      engineResult.cost_details,
    )
    expect(totals.cif).toBeCloseTo(engineResult.cif, 4)
    expect(totals.subtotal_consolidator).toBeCloseTo(engineResult.subtotal_consolidator, 4)
    expect(totals.subtotal_customs_agent).toBeCloseTo(engineResult.subtotal_customs_agent, 4)
    expect(totals.total_cost).toBeCloseTo(engineResult.total_cost, 4)
    expect(totals.nationalization_percentage).toBeCloseTo(engineResult.nationalization_percentage, 4)
  })

  it('sobreescribir el ISV (is_tax) en +$100 NO afecta subtotal_customs_agent, total_cost ni sale_price (es un impuesto de solo visualización)', () => {
    const isvLine = engineResult.cost_details.find((c) => c.component_name === 'ISV')!
    const overridden = engineResult.cost_details.map((c) =>
      c === isvLine ? { ...c, amount_usd: c.amount_usd + 100 } : c,
    )
    const totals = recomputeTotalsFromCostDetails(engineResult.fob, engineResult.margin_amount, overridden)

    expect(totals.subtotal_customs_agent).toBeCloseTo(engineResult.subtotal_customs_agent, 4)
    expect(totals.cif).toBeCloseTo(engineResult.cif, 4) // ISV es CUSTOMS_AGENT, no afecta CIF
    expect(totals.total_cost).toBeCloseTo(engineResult.total_cost, 4)
    expect(totals.sale_price).toBeCloseTo(engineResult.sale_price, 4)
  })

  it('sobreescribir una línea del agente que NO es impuesto (Honorarios) en +$100 sí sube total_cost en +$100', () => {
    const honorariosLine = engineResult.cost_details.find((c) => c.component_name === 'Honorarios Profesionales')!
    const overridden = engineResult.cost_details.map((c) =>
      c === honorariosLine ? { ...c, amount_usd: c.amount_usd + 100 } : c,
    )
    const totals = recomputeTotalsFromCostDetails(engineResult.fob, engineResult.margin_amount, overridden)

    expect(totals.subtotal_customs_agent).toBeCloseTo(engineResult.subtotal_customs_agent + 100, 4)
    expect(totals.total_cost).toBeCloseTo(engineResult.total_cost + 100, 4)
    expect(totals.sale_price).toBeCloseTo(engineResult.sale_price + 100, 4)
  })

  it('sobreescribir una línea del consolidador en +$50 sube CIF, nationalization_base y total_cost en +$50', () => {
    const airFreightLine = engineResult.cost_details.find((c) => c.component_name === 'Air Freight')!
    const overridden = engineResult.cost_details.map((c) =>
      c === airFreightLine ? { ...c, amount_usd: c.amount_usd + 50 } : c,
    )
    const totals = recomputeTotalsFromCostDetails(engineResult.fob, engineResult.margin_amount, overridden)

    expect(totals.subtotal_consolidator).toBeCloseTo(engineResult.subtotal_consolidator + 50, 4)
    expect(totals.cif).toBeCloseTo(engineResult.cif + 50, 4)
    expect(totals.nationalization_base).toBeCloseTo(engineResult.nationalization_base + 50, 4)
    expect(totals.total_cost).toBeCloseTo(engineResult.total_cost + 50, 4)
  })
})
