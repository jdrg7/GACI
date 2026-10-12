import { describe, expect, it } from 'vitest'
import { CalculationType, TransportType } from '@prisma/client'
import { calculateScenario, cheapestOf, type TariffWithComponents } from './quotations.scenarios'
import type { TariffComponentLike } from '../calculation-engine/types'

function component(overrides: Record<string, unknown>) {
  return {
    id: 'c',
    name: 'c',
    calculation_type: CalculationType.FIXED,
    currency_id: 'usd',
    fixed_amount: null,
    rate_per_unit: null,
    rate_percentage: null,
    minimum_amount: null,
    maximum_amount: null,
    tariff_ranges: null,
    basis_unit: null,
    basis_candidates: null,
    service_level: null,
    sort_order: 0,
    notes: null,
    ...overrides,
  }
}

function tariff(transport: TransportType, components: Record<string, unknown>[]): TariffWithComponents {
  return {
    id: `tariff-${transport}`,
    transport_type: transport,
    volumetric_divisor: 166,
    components: components.map(component),
  } as unknown as TariffWithComponents
}

const PRODUCTS = [
  {
    product_id: 'p',
    quantity: 1,
    weight_kg_used: 0,
    weight_lb_used: 100,
    volume_cft_used: 10,
    fob_unit_price: 1000,
    fob_total: 1000,
  },
]

const INPUT = {
  products: PRODUCTS,
  marginAmount: 0,
  otherInternationalCosts: 0,
  exchangeRateUsdToHnl: 27,
  serviceLevel: 'REGULAR' as const,
  customsAgentComponents: [] as TariffComponentLike[],
  toComponentLike: (c: unknown) => ({ ...(c as object), currencyCode: 'USD' }) as unknown as TariffComponentLike,
}

describe('cheapestOf', () => {
  const rows = [
    { mode: TransportType.MARITIMO, total: 600 },
    { mode: TransportType.AEREO, total: 900 },
  ]

  it('elige el de menor costo total', () => {
    const picked = cheapestOf(rows, (r) => r.total, (r) => r.mode)
    expect(picked.mode).toBe(TransportType.MARITIMO)
  })

  it('ante empate prefiere el aéreo', () => {
    const tied = [
      { mode: TransportType.MARITIMO, total: 700 },
      { mode: TransportType.AEREO, total: 700 },
    ]
    expect(cheapestOf(tied, (r) => r.total, (r) => r.mode).mode).toBe(TransportType.AEREO)
  })
})

describe('calculateScenario', () => {
  it('calcula cada modo con su propia tarifa y devuelve sus totales', () => {
    const air = calculateScenario(tariff(TransportType.AEREO, [{ name: 'Flete', fixed_amount: 500 }]), INPUT)
    const sea = calculateScenario(tariff(TransportType.MARITIMO, [{ name: 'Flete', fixed_amount: 200 }]), INPUT)

    expect(air.transport_type).toBe(TransportType.AEREO)
    expect(air.consolidator_tariff_id).toBe('tariff-AEREO')
    expect(air.totals.subtotal_consolidator).toBe(500)
    expect(sea.totals.subtotal_consolidator).toBe(200)
    // El CIF (base del impuesto) cambia con el flete de cada modo.
    expect(air.totals.cif).toBeGreaterThan(sea.totals.cif)
  })

  it('usa el divisor volumétrico de la tarifa para el peso volumétrico', () => {
    const base = tariff(TransportType.AEREO, [])
    const custom = { ...base, volumetric_divisor: 139 } as unknown as TariffWithComponents

    const withDefault = calculateScenario(base, INPUT)
    const withCustom = calculateScenario(custom, INPUT)

    // 10 CFT × 1728 / 166 = 104.1 lb; con divisor 139 = 124.3 lb
    expect(withDefault.result.volumetric_weight_lb).toBeCloseTo(104.096, 2)
    expect(withCustom.result.volumetric_weight_lb).toBeCloseTo(124.317, 2)
  })
})
