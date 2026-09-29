import { describe, expect, it } from 'vitest'
import { applyTariffRanges, type TariffRangeItem } from './range-calculator'

// Todos los tramos usados aquí son copia exacta de prisma/seed.ts — son las
// tarifas reales sembradas (PFI Aéreo/Marítimo Honduras 2026 + Agente Aduanero).

describe('applyTariffRanges — tipo "fixed" (tramo de llegada)', () => {
  const airFreight: TariffRangeItem[] = [
    { from: 0, to: 50, type: 'fixed', amount: 210 },
    { from: 50, to: null, type: 'base_plus', base: 210, rate: 1.85, base_from: 50 },
  ]

  it('devuelve el monto fijo cuando la cantidad cae exactamente en el límite superior del tramo', () => {
    expect(applyTariffRanges(airFreight, 50)).toBe(210)
  })

  it('devuelve el monto fijo para cualquier cantidad dentro del tramo', () => {
    expect(applyTariffRanges(airFreight, 20)).toBe(210)
  })
})

describe('applyTariffRanges — tipo "base_plus" (fórmula cerrada)', () => {
  it('Air Freight: 300 KG → $672.50 (verificado: $210 + (300-50)×$1.85)', () => {
    const ranges: TariffRangeItem[] = [
      { from: 0, to: 50, type: 'fixed', amount: 210 },
      { from: 50, to: null, type: 'base_plus', base: 210, rate: 1.85, base_from: 50 },
    ]
    expect(applyTariffRanges(ranges, 300)).toBe(672.5)
  })

  it('Fuel Surcharge: 300 KG → $187.50 (verificado: $50 + (300-50)×$0.55)', () => {
    const ranges: TariffRangeItem[] = [
      { from: 0, to: 50, type: 'fixed', amount: 50 },
      { from: 50, to: null, type: 'base_plus', base: 50, rate: 0.55, base_from: 50 },
    ]
    expect(applyTariffRanges(ranges, 300)).toBe(187.5)
  })

  it('Almacenaje: 300 KG → L13,900 (verificado: L1,400 + (300-50)×L50)', () => {
    const ranges: TariffRangeItem[] = [
      { from: 0, to: 50, type: 'fixed', amount: 1400 },
      { from: 50, to: null, type: 'base_plus', base: 1400, rate: 50, base_from: 50 },
    ]
    expect(applyTariffRanges(ranges, 300)).toBe(13900)
  })
})

describe('applyTariffRanges — tipo "block_ceil" (Flete Terrestre)', () => {
  const fleteTerrestre: TariffRangeItem[] = [
    { from: 0, to: 300, type: 'fixed', amount: 1200 },
    { from: 300, to: null, type: 'block_ceil', base: 1200, rate: 50, block_size: 10, base_from: 300 },
  ]

  it('≤300 KG cae en el tramo fixed: L1,200 (no ejercita block_ceil)', () => {
    expect(applyTariffRanges(fleteTerrestre, 300)).toBe(1200)
  })

  it('310 KG → L1,250 (CEIL((310-300)/10)=1 bloque × L50)', () => {
    expect(applyTariffRanges(fleteTerrestre, 310)).toBe(1250)
  })

  it('355 KG → L1,500 (excede el bloque exacto: CEIL(5.5)=6 bloques × L50 — redondea hacia arriba)', () => {
    expect(applyTariffRanges(fleteTerrestre, 355)).toBe(1500)
  })

  it('360 KG → L1,500 (CEIL(6)=6 bloques, cae justo en el límite del bloque)', () => {
    expect(applyTariffRanges(fleteTerrestre, 360)).toBe(1500)
  })

  it('361 KG → L1,550 (CEIL(6.1)=7 bloques — un kg de más ya cobra el siguiente bloque completo)', () => {
    expect(applyTariffRanges(fleteTerrestre, 361)).toBe(1550)
  })
})

describe('applyTariffRanges — tipo "per_unit" (progresivo acumulativo, KG)', () => {
  const supervision: TariffRangeItem[] = [
    { from: 0, to: 50, type: 'fixed', amount: 200 },
    { from: 50, to: 550, type: 'per_unit', rate: 0.08 },
    { from: 550, to: 1550, type: 'per_unit', rate: 0.06 },
    { from: 1550, to: 6550, type: 'per_unit', rate: 0.05 },
    { from: 6550, to: null, type: 'per_unit', rate: 0.05 },
  ]

  it('300 KG → L220 (caso de negocio verificado en schema.prisma)', () => {
    expect(applyTariffRanges(supervision, 300)).toBe(220)
  })

  it('50 KG (límite del primer tramo) → L200 exacto, sin cargo progresivo', () => {
    expect(applyTariffRanges(supervision, 50)).toBe(200)
  })

  it('1000 KG → acumula 3 tramos: L200 + 500×0.08 + 450×0.06 = L267', () => {
    // tramo1: 200 (fijo)
    // tramo2 (50-550): 500 × 0.08 = 40
    // tramo3 (550-1550, cae aquí): (1000-550) × 0.06 = 27
    expect(applyTariffRanges(supervision, 1000)).toBe(267)
  })
})

describe('applyTariffRanges — tipo "per_value" (progresivo acumulativo con mínimo por tramo, RANGE_VALUE)', () => {
  const honorarios: TariffRangeItem[] = [
    { from: 0, to: 1500, type: 'fixed', amount: 1000 },
    { from: 1500, to: 4000, type: 'per_value', rate: 0.05, min: 125 },
    { from: 4000, to: 24000, type: 'per_value', rate: 0.03, min: 600 },
    { from: 24000, to: 64000, type: 'per_value', rate: 0.015, min: 600 },
    { from: 64000, to: 124000, type: 'per_value', rate: 0.01, min: 600 },
    { from: 124000, to: 200000, type: 'per_value', rate: 0.006, min: 456 },
    { from: 200000, to: null, type: 'per_value', rate: 0.005 },
  ]

  it('CIF L351,997.14 → L4,140.9857 (caso de negocio verificado en schema.prisma)', () => {
    expect(applyTariffRanges(honorarios, 351997.14)).toBeCloseTo(4140.9857, 4)
  })

  it('el último tramo (>200,000) no tiene "min" — se usa la tasa tal cual sin piso', () => {
    // CIF exactamente 250,000: tramos 1-6 acumulan 1000+125+600+600+600+456=3381
    // tramo 7: (250000-200000)×0.005 = 250, sin mínimo que lo eleve
    expect(applyTariffRanges(honorarios, 250000)).toBe(3631)
  })
})

describe('applyTariffRanges — RANGE_LB (Pick Up & Delivery marítimo, nunca probado antes)', () => {
  const pickUpDelivery: TariffRangeItem[] = [
    { from: 0, to: 1250, type: 'fixed', amount: 75 },
    { from: 1250, to: 2083, type: 'fixed', amount: 125 },
    { from: 2083, to: null, type: 'base_plus', base: 125, rate: 0.06, base_from: 2083 },
  ]

  it('1,000 LB (tramo 1) → $75 flat', () => {
    expect(applyTariffRanges(pickUpDelivery, 1000)).toBe(75)
  })

  it('1,251 LB (justo entrando al tramo 2) → $125 flat', () => {
    expect(applyTariffRanges(pickUpDelivery, 1251)).toBe(125)
  })

  it('2,083 LB (límite superior del tramo 2) → $125 flat', () => {
    expect(applyTariffRanges(pickUpDelivery, 2083)).toBe(125)
  })

  it('2,500 LB (tramo 3, base_plus) → $150.02 ($125 + (2500-2083)×$0.06)', () => {
    expect(applyTariffRanges(pickUpDelivery, 2500)).toBeCloseTo(150.02, 4)
  })
})
