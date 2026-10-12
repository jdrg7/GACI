import { describe, expect, it } from 'vitest'
import { CalculationType } from '@prisma/client'
import { calculateQuotation } from './engine.service'
import { AIR, comp, runShipment as run, shipment, type Piece } from './pfi-fixtures'

// Casos de oro calculados con las fórmulas de "CALCULATOR TECNASA HONDURAS.xlsx" (PFI).
// Los totales del Excel son solo flete del consolidador → se comparan con subtotal_consolidator.
// Tolerancia: ±$0.01 (el Excel no redondea; el motor redondea a 4 decimales por línea).

function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.01)
}

interface GoldenCase {
  name: string
  pieces: Piece[]
  air: number
  airPriority: number
  sea: number
}

const CASES: [GoldenCase, GoldenCase, GoldenCase, GoldenCase, GoldenCase] = [
  {
    name: 'A — Excel de PFI (452 lb, 68.49 CFT)',
    pieces: [
      { pcs: 8, l: 55, w: 33, h: 7, lbEach: 49 },
      { pcs: 2, l: 24, w: 24, h: 10, lbEach: 15 },
      { pcs: 1, l: 12, w: 12, h: 12, lbEach: 10 },
      { pcs: 2, l: 12, w: 12, h: 12, lbEach: 10 },
    ],
    air: 1108.0903,
    airPriority: 1415.2979,
    sea: 623.9398,
  },
  {
    name: 'B — caja pequeña (todo en mínimos)',
    pieces: [{ pcs: 1, l: 12, w: 12, h: 12, lbEach: 10 }],
    air: 495,
    airPriority: 555,
    sea: 576,
  },
  {
    name: 'C — carga densa (gana peso real)',
    pieces: [{ pcs: 4, l: 24, w: 24, h: 20, lbEach: 125 }],
    air: 830.9117,
    airPriority: 1046.3703,
    sea: 576,
  },
  {
    name: 'D — voluminosa liviana (gana volumen)',
    pieces: [{ pcs: 10, l: 48, w: 40, h: 40, lbEach: 30 }],
    air: 6312.9543,
    airPriority: 8306.5952,
    sea: 2387,
  },
  {
    name: 'E — pesada, Delivery marítimo sobre el mínimo',
    pieces: [{ pcs: 10, l: 40, w: 30, h: 30, lbEach: 250 }],
    air: 3459.5587,
    airPriority: 4536.8516,
    sea: 1500.2083,
  },
]

describe('Casos de oro PFI — subtotal del consolidador', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it('aéreo regular', () => expectClose(run(c.pieces, 'AIR').subtotal_consolidator, c.air))
      it('aéreo Priority', () => expectClose(run(c.pieces, 'AIR', 'PRIORITY').subtotal_consolidator, c.airPriority))
      it('marítimo', () => expectClose(run(c.pieces, 'SEA').subtotal_consolidator, c.sea))
    })
  }
})

describe('Peso cobrable y base ganadora', () => {
  it('caso A: gana el volumen (323.376 kg cobrables, Air Freight cobra por VOL_KG)', () => {
    const result = run(CASES[0].pieces, 'AIR')
    expect(result.total_weight_lb).toBeCloseTo(452, 3)
    expect(result.total_weight_kg).toBeCloseTo(205.026, 3)
    expect(result.volumetric_weight_lb).toBeCloseTo(712.916, 3)
    expect(result.chargeable_weight_kg).toBeCloseTo(323.376, 3)
    const airFreight = result.cost_details.find((l) => l.component_name === 'Air Freight')!
    expect(airFreight.calculation_basis).toBe('VOL_KG')
  })

  it('caso C: gana el peso real (Air Freight cobra por KG)', () => {
    const airFreight = run(CASES[2].pieces, 'AIR').cost_details.find((l) => l.component_name === 'Air Freight')!
    expect(airFreight.calculation_basis).toBe('KG')
  })

  it('caso A marítimo: Ocean Freight gana por CFT; caso E también (685 vs 250 por LB)', () => {
    for (const golden of [CASES[0], CASES[4]]) {
      const ocean = run(golden.pieces, 'SEA').cost_details.find((l) => l.component_name === 'Ocean Freight')!
      expect(ocean.calculation_basis).toBe('CFT')
    }
  })

  it('caso B: las líneas con mínimo quedan en su mínimo (Ocean Freight = $221)', () => {
    const ocean = run(CASES[1].pieces, 'SEA').cost_details.find((l) => l.component_name === 'Ocean Freight')!
    expect(ocean.amount_usd).toBe(221)
  })
})

describe('Nivel de servicio', () => {
  it('por defecto es REGULAR: solo aparece el Air Freight regular', () => {
    const lines = run(CASES[0].pieces, 'AIR').cost_details.filter((l) => l.component_name === 'Air Freight')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.amount_usd).toBeCloseTo(598.2464, 3)
  })

  it('PRIORITY reemplaza el Air Freight y cambia solo esa línea', () => {
    const regular = run(CASES[0].pieces, 'AIR')
    const priority = run(CASES[0].pieces, 'AIR', 'PRIORITY')
    const lines = priority.cost_details.filter((l) => l.component_name === 'Air Freight')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.amount_usd).toBeCloseTo(905.454, 3)

    const withoutAirFreight = (r: typeof regular) =>
      r.cost_details.filter((l) => l.component_name !== 'Air Freight').map((l) => [l.component_name, l.amount_usd])
    expect(withoutAirFreight(priority)).toEqual(withoutAirFreight(regular))
  })

  it('el marítimo ignora el nivel de servicio', () => {
    expect(run(CASES[0].pieces, 'SEA', 'PRIORITY').subtotal_consolidator).toBe(
      run(CASES[0].pieces, 'SEA', 'REGULAR').subtotal_consolidator,
    )
  })
})

describe('El agente aduanero usa peso real', () => {
  it('Supervisión (RANGE_KG) se calcula sobre kg reales aunque el volumétrico sea mucho mayor (caso D)', () => {
    const supervision = comp({
      id: 'supervision',
      name: 'Supervisión',
      calculation_type: CalculationType.RANGE_KG,
      currencyCode: 'HNL',
      tariff_ranges: [
        { from: 0, to: 50, type: 'fixed', amount: 200 },
        { from: 50, to: null, type: 'per_unit', rate: 0.08 },
      ],
    })
    const result = calculateQuotation({
      products: shipment(CASES[3].pieces),
      otherInternationalCosts: 0,
      marginAmount: 0,
      exchangeRateUsdToHnl: 27.004,
      consolidatorComponents: AIR,
      customsAgentComponents: [supervision],
    })
    const line = result.cost_details.find((l) => l.component_name === 'Supervisión')!
    expect(line.basis_value).toBeCloseTo(136.079, 3)
    expect(result.chargeable_weight_kg).toBeGreaterThan(2000)
  })
})
