import { describe, expect, it } from 'vitest'
import { CalculationType, TariffBasis } from '@prisma/client'
import { calculateComponent } from './component-calculator'
import type { ComponentBasis, TariffComponentLike } from './types'

const EXCHANGE_RATE = 27.004 // USD→HNL, tasa del caso de negocio verificado

const ZERO_BASIS: ComponentBasis = { weightKg: 0, weightLb: 0, volumeCft: 0, cifUsd: 0 }

function component(overrides: Record<string, unknown>): TariffComponentLike {
  return {
    id: 'test-component',
    name: 'Componente de prueba',
    calculation_type: CalculationType.FIXED,
    currencyCode: 'USD',
    currency_id: 'currency-id',
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

describe('calculateComponent — FIXED', () => {
  it('devuelve el monto fijo tal cual, sin depender de la base', () => {
    const result = calculateComponent(
      component({ calculation_type: CalculationType.FIXED, fixed_amount: 55 }),
      ZERO_BASIS,
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(55)
    expect(result.amount_usd).toBe(55)
    expect(result.calculation_basis).toBeNull()
  })
})

describe('calculateComponent — PER_KG / PER_LB / PER_CFT (tasa directa)', () => {
  it('PER_KG: rate_per_unit × weightKg', () => {
    const result = calculateComponent(
      component({ calculation_type: CalculationType.PER_KG, rate_per_unit: 2.5 }),
      { ...ZERO_BASIS, weightKg: 40 },
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(100)
    expect(result.calculation_basis).toBe('KG')
    expect(result.basis_value).toBe(40)
  })

  it('PER_CFT: rate_per_unit × volumeCft', () => {
    const result = calculateComponent(
      component({ calculation_type: CalculationType.PER_CFT, rate_per_unit: 3 }),
      { ...ZERO_BASIS, volumeCft: 12 },
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(36)
    expect(result.calculation_basis).toBe('CFT')
  })
})

describe('calculateComponent — MAX_OF (usa basis_unit para desambiguar KG/LB/CFT)', () => {
  it('Security Surcharge (basis_unit=KG): MAX(300×0.15, 40) = 45', () => {
    const result = calculateComponent(
      component({
        calculation_type: CalculationType.MAX_OF,
        rate_per_unit: 0.15,
        minimum_amount: 40,
        basis_unit: TariffBasis.KG,
      }),
      { ...ZERO_BASIS, weightKg: 300, weightLb: 661.386 },
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(45)
    expect(result.calculation_basis).toBe('KG')
  })

  it('Delivery (basis_unit=LB, no KG — bug real corregido durante el desarrollo): MAX(661.386×0.06, 75) = 75', () => {
    const result = calculateComponent(
      component({
        calculation_type: CalculationType.MAX_OF,
        rate_per_unit: 0.06,
        minimum_amount: 75,
        basis_unit: TariffBasis.LB,
      }),
      { ...ZERO_BASIS, weightKg: 300, weightLb: 661.386 },
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(75) // el mínimo domina; la tasa da 39.68
    expect(result.calculation_basis).toBe('LB')
    expect(result.basis_value).toBe(661.386)
  })

  it('Ocean Freight (basis_unit=CFT, marítimo): MAX(10×3.00, 175) = 175 (mínimo domina)', () => {
    const result = calculateComponent(
      component({
        calculation_type: CalculationType.MAX_OF,
        rate_per_unit: 3.0,
        minimum_amount: 175,
        basis_unit: TariffBasis.CFT,
      }),
      { ...ZERO_BASIS, volumeCft: 10 },
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(175)
    expect(result.calculation_basis).toBe('CFT')
  })
})

describe('calculateComponent — PER_VALUE (ISV, siempre sobre CIF)', () => {
  it('ISV en USD: CIF_USD × 15%, sin conversión (verificado: CIF $13,035 → $1,955.25)', () => {
    const result = calculateComponent(
      component({ calculation_type: CalculationType.PER_VALUE, rate_percentage: 0.15, currencyCode: 'USD' }),
      { ...ZERO_BASIS, cifUsd: 13035 },
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(1955.25)
    expect(result.original_currency).toBe('USD')
    expect(result.amount_usd).toBe(1955.25)
    expect(result.calculation_basis).toBe('CIF_USD')
  })

  it('PER_VALUE en HNL: la base se convierte a CIF_HNL antes de aplicar la tasa', () => {
    const result = calculateComponent(
      component({ calculation_type: CalculationType.PER_VALUE, rate_percentage: 0.1, currencyCode: 'HNL' }),
      { ...ZERO_BASIS, cifUsd: 1000 },
      27, // TC redondo para verificar a mano
    )
    // CIF_HNL = 1000 × 27 = 27000; 27000 × 0.1 = 2700 HNL → 2700/27 = 100 USD
    expect(result.original_amount).toBe(2700)
    expect(result.original_currency).toBe('HNL')
    expect(result.calculation_basis).toBe('CIF_HNL')
    expect(result.amount_usd).toBe(100)
  })
})

describe('calculateComponent — RANGE_VALUE (Honorarios/Manejo, vía el componente completo)', () => {
  it('reproduce el caso verificado: CIF_HNL 351,997.14 → L4,140.9857 → $153.35 USD (TC 27.004)', () => {
    const result = calculateComponent(
      component({
        calculation_type: CalculationType.RANGE_VALUE,
        currencyCode: 'HNL',
        tariff_ranges: [
          { from: 0, to: 1500, type: 'fixed', amount: 1000 },
          { from: 1500, to: 4000, type: 'per_value', rate: 0.05, min: 125 },
          { from: 4000, to: 24000, type: 'per_value', rate: 0.03, min: 600 },
          { from: 24000, to: 64000, type: 'per_value', rate: 0.015, min: 600 },
          { from: 64000, to: 124000, type: 'per_value', rate: 0.01, min: 600 },
          { from: 124000, to: 200000, type: 'per_value', rate: 0.006, min: 456 },
          { from: 200000, to: null, type: 'per_value', rate: 0.005 },
        ],
      }),
      { ...ZERO_BASIS, cifUsd: 13035 },
      27.004,
    )
    expect(result.original_amount).toBeCloseTo(4140.9857, 4)
    expect(result.amount_usd).toBeCloseTo(153.35, 2)
  })
})

describe('calculateComponent — maximum_amount (techo universal, cualquier calculation_type)', () => {
  it('recorta el resultado de un MAX_OF que excede el techo', () => {
    const result = calculateComponent(
      component({
        calculation_type: CalculationType.MAX_OF,
        rate_per_unit: 5,
        minimum_amount: 10,
        maximum_amount: 100,
        basis_unit: TariffBasis.KG,
      }),
      { ...ZERO_BASIS, weightKg: 50 }, // 5×50=250, muy por encima del techo
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(100)
    expect(result.calculation_snapshot).toMatchObject({ result: 250, capped_by_maximum_amount: 100 })
  })

  it('no afecta el resultado cuando está por debajo del techo', () => {
    const result = calculateComponent(
      component({ calculation_type: CalculationType.FIXED, fixed_amount: 30, maximum_amount: 100 }),
      ZERO_BASIS,
      EXCHANGE_RATE,
    )
    expect(result.original_amount).toBe(30)
  })
})
