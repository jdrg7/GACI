import { describe, expect, it } from 'vitest'
import { consolidatorTariffComponentSchema } from './consolidator-tariffs.schema'

const CURRENCY_ID = '7b162573-7dd7-47ee-9718-b811c4be0e10'

function parse(overrides: Record<string, unknown>) {
  return consolidatorTariffComponentSchema.safeParse({
    name: 'Componente',
    currency_id: CURRENCY_ID,
    calculation_type: 'MAX_OF',
    ...overrides,
  })
}

describe('consolidatorTariffComponentSchema — MAX_OF multi-base', () => {
  it('acepta MAX_OF con bases candidatas sin tarifa, mínimo ni base únicos', () => {
    const result = parse({
      basis_candidates: [
        { basis: 'CFT', rate: 3.29, minimum: 221 },
        { basis: 'LB', rate: 0.1, minimum: 221 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('MAX_OF sin candidatas sigue exigiendo rate_per_unit, minimum_amount y basis_unit', () => {
    const result = parse({})
    expect(result.success).toBe(false)
    const paths = result.error?.issues.map((i) => i.path.join('.')) ?? []
    expect(paths).toEqual(expect.arrayContaining(['rate_per_unit', 'minimum_amount', 'basis_unit']))
  })

  it('MAX_OF de una sola base (forma clásica) sigue siendo válido', () => {
    expect(parse({ rate_per_unit: 0.06, minimum_amount: 125, basis_unit: 'LB' }).success).toBe(true)
  })

  it('rechaza basis_candidates en un tipo distinto de MAX_OF', () => {
    const result = parse({
      calculation_type: 'FIXED',
      fixed_amount: 50,
      basis_candidates: [{ basis: 'KG', rate: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('rechaza una base candidata desconocida o una lista vacía', () => {
    expect(parse({ basis_candidates: [{ basis: 'TON', rate: 1 }] }).success).toBe(false)
    expect(parse({ basis_candidates: [] }).success).toBe(false)
  })

  it('acepta service_level REGULAR/PRIORITY y rechaza otros valores', () => {
    const base = { calculation_type: 'FIXED', fixed_amount: 50 }
    expect(parse({ ...base, service_level: 'PRIORITY' }).success).toBe(true)
    expect(parse({ ...base, service_level: 'EXPRESS' }).success).toBe(false)
  })
})
