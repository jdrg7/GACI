import { describe, expect, it } from 'vitest'
import { excelFreight, runShipment, type Piece } from './pfi-fixtures'

// Corrida en paralelo contra el calculador de PFI: cientos de embarques generados con una
// semilla fija se calculan con el motor y con un oráculo que transcribe las fórmulas del
// Excel (excelFreight). El motor redondea cada línea a 4 decimales, así que la diferencia
// real es < $0.001; cualquier valor mayor es una regresión.

const TOLERANCE = 0.001

// PRNG determinista (mulberry32) para que la corrida sea reproducible.
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomShipment(rand: () => number): Piece[] {
  const between = (min: number, max: number) => min + rand() * (max - min)
  const lines = 1 + Math.floor(rand() * 6)
  return Array.from({ length: lines }, () => ({
    pcs: 1 + Math.floor(rand() * 25),
    l: Math.round(between(3, 72) * 10) / 10,
    w: Math.round(between(3, 60) * 10) / 10,
    h: Math.round(between(2, 60) * 10) / 10,
    lbEach: Math.round(between(0.5, 300) * 10) / 10,
  }))
}

const SHIPMENT_COUNT = 500

describe(`Paridad con el Excel de PFI — ${SHIPMENT_COUNT} embarques aleatorios`, () => {
  const rand = mulberry32(20261012)
  const shipments = Array.from({ length: SHIPMENT_COUNT }, () => randomShipment(rand))

  const modes = [
    { name: 'aéreo regular', mode: 'AIR' as const, priority: false },
    { name: 'aéreo Priority', mode: 'AIR' as const, priority: true },
    { name: 'marítimo', mode: 'SEA' as const, priority: false },
  ]

  for (const { name, mode, priority } of modes) {
    it(`${name}: el motor coincide con el oráculo (±$${TOLERANCE})`, () => {
      const failures: string[] = []
      for (const pieces of shipments) {
        const engine = runShipment(pieces, mode, priority ? 'PRIORITY' : undefined).subtotal_consolidator
        const oracle = excelFreight(pieces, mode, priority)
        const diff = Math.abs(engine - oracle)
        if (diff > TOLERANCE) failures.push(`${JSON.stringify(pieces)} → motor ${engine} vs Excel ${oracle} (Δ ${diff})`)
      }
      expect(failures).toEqual([])
    })
  }

  it('el cobro aéreo nunca baja del mínimo de cada línea y el marítimo nunca del suyo', () => {
    for (const pieces of shipments) {
      expect(runShipment(pieces, 'AIR').subtotal_consolidator).toBeGreaterThanOrEqual(210 + 50 + 25 + 75 + 50 + 55 + 20 + 10)
      expect(runShipment(pieces, 'SEA').subtotal_consolidator).toBeGreaterThanOrEqual(221 + 50 + 50 + 20 + 85 + 25 + 125)
    }
  })

  it('Priority nunca es más barato que Regular', () => {
    for (const pieces of shipments) {
      const regular = runShipment(pieces, 'AIR').subtotal_consolidator
      const priority = runShipment(pieces, 'AIR', 'PRIORITY').subtotal_consolidator
      expect(priority).toBeGreaterThanOrEqual(regular)
    }
  })
})

describe('Paridad con el Excel de PFI — puntos de quiebre', () => {
  // Una sola pieza diminuta: el peso volumétrico no influye y manda el peso real.
  const heavy = (lb: number): Piece[] => [{ pcs: 1, l: 1, w: 1, h: 1, lbEach: lb }]

  it('Air Freight: bajo ~113.51 kg cobra el mínimo $210; por encima cobra $1.85/kg', () => {
    const kgToLb = (kg: number) => kg * 2.2046
    const below = runShipment(heavy(kgToLb(113.4)), 'AIR').cost_details.find((l) => l.component_name === 'Air Freight')!
    const above = runShipment(heavy(kgToLb(113.7)), 'AIR').cost_details.find((l) => l.component_name === 'Air Freight')!
    expect(below.amount_usd).toBe(210)
    expect(above.amount_usd).toBeCloseTo(113.7 * 1.85, 3)
  })

  it('Delivery marítimo: bajo 2,083.33 lb cobra el mínimo $125; por encima cobra $0.06/lb', () => {
    const below = runShipment(heavy(2000), 'SEA').cost_details.find((l) => l.component_name === 'Delivery')!
    const above = runShipment(heavy(2200), 'SEA').cost_details.find((l) => l.component_name === 'Delivery')!
    expect(below.amount_usd).toBe(125)
    expect(above.amount_usd).toBeCloseTo(2200 * 0.06, 3)
  })

  it('un embarque enorme (20,000 lb, 500 CFT) sigue coincidiendo con el Excel', () => {
    const pieces: Piece[] = [{ pcs: 100, l: 40, w: 36, h: 12, lbEach: 200 }]
    for (const [mode, priority] of [
      ['AIR', false],
      ['AIR', true],
      ['SEA', false],
    ] as const) {
      const engine = runShipment(pieces, mode, priority ? 'PRIORITY' : undefined).subtotal_consolidator
      expect(Math.abs(engine - excelFreight(pieces, mode, priority))).toBeLessThanOrEqual(TOLERANCE)
    }
  })
})
