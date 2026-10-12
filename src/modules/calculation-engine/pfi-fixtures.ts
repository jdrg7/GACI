// Tarifas PFI Honduras 2026 y helpers de embarque compartidos por las pruebas de paridad con
// "CALCULATOR TECNASA HONDURAS.xlsx". Es una copia fiel de lo sembrado en prisma/seed.ts.
import { CalculationType } from '@prisma/client'
import { calculateQuotation } from './engine.service'
import type { BasisCandidate, QuotationProductInput, ServiceLevel, TariffComponentLike } from './types'

export function comp(overrides: Record<string, unknown>): TariffComponentLike {
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
    basis_candidates: null,
    service_level: null,
    sort_order: 0,
    notes: null,
    ...overrides,
  } as unknown as TariffComponentLike
}

function multi(
  name: string,
  candidates: BasisCandidate[],
  serviceLevel: ServiceLevel | null = null,
): TariffComponentLike {
  return comp({
    id: `${name}-${serviceLevel ?? 'all'}`,
    name,
    calculation_type: CalculationType.MAX_OF,
    basis_candidates: candidates,
    service_level: serviceLevel,
  })
}

const fixed = (name: string, amount: number) =>
  comp({ id: name, name, calculation_type: CalculationType.FIXED, fixed_amount: amount })

// Aéreo: peso cobrable = MAX(real, volumétrico) → una candidata por base con la misma tarifa y mínimo.
const byWeight = (rate: number, minimum: number): BasisCandidate[] => [
  { basis: 'KG', rate, minimum },
  { basis: 'VOL_KG', rate, minimum },
]

export const AIR: TariffComponentLike[] = [
  multi('Air Freight', byWeight(1.85, 210), 'REGULAR'),
  multi('Air Freight', byWeight(2.8, 270), 'PRIORITY'),
  multi('Fuel', byWeight(0.55, 50)),
  multi('Security', byWeight(0.15, 25)),
  multi('Cartage', [
    { basis: 'LB', rate: 0.04, minimum: 75 },
    { basis: 'VOL_LB', rate: 0.04, minimum: 75 },
  ]),
  fixed('Forwarding Fee', 50),
  fixed('TSA', 55),
  multi('Fuel Index Surcharge', byWeight(0.2, 20)),
  multi('Screening Surcharge', byWeight(0.12, 10)),
]

export const SEA: TariffComponentLike[] = [
  multi('Ocean Freight', [
    { basis: 'CFT', rate: 3.29, minimum: 221 },
    { basis: 'LB', rate: 0.1, minimum: 221 },
  ]),
  multi('Fuel Surcharge', [
    { basis: 'CFT', rate: 1.367, minimum: 50 },
    { basis: 'LB', rate: 0.1, minimum: 50 },
  ]),
  multi('Security', [
    { basis: 'CFT', rate: 0.14, minimum: 50 },
    { basis: 'LB', rate: 0.1, minimum: 50 },
  ]),
  fixed('B/L', 20),
  fixed('Forwarding Fee', 85),
  fixed('Accessorial', 25),
  multi('Delivery', [{ basis: 'LB', rate: 0.06, minimum: 125 }]),
]

export interface Piece {
  pcs: number
  l: number
  w: number
  h: number
  lbEach: number
}

// Como el Excel: lb reales = Σ piezas × peso; CFT = Σ (L × A × H / 1728) × piezas.
export function shipment(pieces: Piece[]): QuotationProductInput[] {
  const lb = pieces.reduce((s, p) => s + p.pcs * p.lbEach, 0)
  const cft = pieces.reduce((s, p) => s + (p.pcs * p.l * p.w * p.h) / 1728, 0)
  return [
    {
      product_id: 'p1',
      quantity: 1,
      weight_kg_used: 0, // el motor deriva kg desde lb
      weight_lb_used: lb,
      volume_cft_used: cft,
      fob_unit_price: 1000,
      fob_total: 1000,
    },
  ]
}

export function runShipment(pieces: Piece[], mode: 'AIR' | 'SEA', serviceLevel?: ServiceLevel) {
  return calculateQuotation({
    products: shipment(pieces),
    otherInternationalCosts: 0,
    marginAmount: 0,
    exchangeRateUsdToHnl: 27.004,
    consolidatorComponents: mode === 'AIR' ? AIR : SEA,
    customsAgentComponents: [],
    ...(serviceLevel ? { serviceLevel } : {}),
  })
}

// Oráculo independiente: transcripción directa de las fórmulas del Excel de PFI (sin usar el
// mecanismo de bases candidatas del motor). Devuelve el total de flete del consolidador.
export function excelFreight(pieces: Piece[], mode: 'AIR' | 'SEA', priority = false): number {
  const lb = pieces.reduce((s, p) => s + p.pcs * p.lbEach, 0)
  const cft = pieces.reduce((s, p) => s + (p.pcs * p.l * p.w * p.h) / 1728, 0)
  const volLb = pieces.reduce((s, p) => s + (p.pcs * p.l * p.w * p.h) / 166, 0)
  const kg = lb / 2.2046
  const volKg = volLb / 2.2046
  const max = Math.max

  if (mode === 'AIR') {
    const cobrable = max(kg, volKg) // N13 = IF(B4>B8, B4, B8)
    const airFreight = priority ? max(cobrable * 2.8, 270) : max(cobrable * 1.85, 210)
    return (
      airFreight +
      max(cobrable * 0.55, 50) + // fuel
      max(cobrable * 0.15, 25) + // security
      max(max(lb, volLb) * 0.04, 75) + // cartage: N16 = IF(B3>B7, B3, B7)
      50 + // forwarding
      55 + // TSA
      max(cobrable * 0.2, 20) + // fuel index
      max(cobrable * 0.12, 10) // screening
    )
  }

  // Marítimo: cada línea es el mayor entre la tarifa por CFT y la tarifa por LB (G14:G19).
  const ocean = max(max(cft * 3.29, 221), max(lb * 0.1, 221))
  const fuel = max(max(cft * 1.367, 50), max(lb * 0.1, 50))
  const security = max(max(cft * 0.14, 50), max(lb * 0.1, 50))
  const delivery = max(lb * 0.06, 125)
  return ocean + fuel + security + 20 + 85 + 25 + delivery
}
