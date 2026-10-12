import { CalculationType, TariffBasis } from '@prisma/client'
import { round } from '../../shared/utils/round'
import { toUsd } from './currency.converter'
import { applyTariffRanges, type TariffRangeItem } from './range-calculator'
import type { CandidateBasis, ComponentBasis, ComponentCalculationResult, TariffComponentLike } from './types'

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value)
}

type Unit = CandidateBasis

function resolveBasisQuantity(unit: Unit, basis: ComponentBasis): number {
  if (unit === 'KG') return basis.weightKg
  if (unit === 'LB') return basis.weightLb
  if (unit === 'VOL_KG') return basis.volumetricWeightKg
  if (unit === 'VOL_LB') return basis.volumetricWeightLb
  return basis.volumeCft
}

function unitForMaxOf(basisUnit: TariffBasis | null): Unit {
  if (basisUnit === TariffBasis.LB) return 'LB'
  if (basisUnit === TariffBasis.CFT) return 'CFT'
  return 'KG'
}

export function calculateComponent(
  component: TariffComponentLike,
  basis: ComponentBasis,
  exchangeRateUsdToHnl: number,
): ComponentCalculationResult {
  const currency = component.currencyCode
  const type = component.calculation_type

  let originalAmount = 0
  let calculationBasis: ComponentCalculationResult['calculation_basis'] = null
  let basisValue: number | null = null
  let snapshot: Record<string, unknown> = { type }

  switch (type) {
    case CalculationType.FIXED: {
      originalAmount = toNumber(component.fixed_amount)
      snapshot = { type, amount: originalAmount }
      break
    }

    case CalculationType.PER_KG:
    case CalculationType.PER_LB:
    case CalculationType.PER_CFT: {
      const unit: Unit = type === CalculationType.PER_KG ? 'KG' : type === CalculationType.PER_LB ? 'LB' : 'CFT'
      const quantity = resolveBasisQuantity(unit, basis)
      originalAmount = round(toNumber(component.rate_per_unit) * quantity, 4)
      calculationBasis = unit
      basisValue = quantity
      snapshot = { type, rate: toNumber(component.rate_per_unit), quantity, result: originalAmount }
      break
    }

    case CalculationType.MAX_OF: {
      const candidates = component.basis_candidates
      if (candidates && candidates.length > 0) {
        const evaluated = candidates.map((candidate) => {
          const quantity = resolveBasisQuantity(candidate.basis, basis)
          const minimum = candidate.minimum ?? 0
          const amount = Math.max(round(candidate.rate * quantity, 4), minimum)
          return { basis: candidate.basis, rate: candidate.rate, quantity, minimum, amount }
        })
        const winner = evaluated.reduce((best, current) => (current.amount > best.amount ? current : best))
        originalAmount = winner.amount
        calculationBasis = winner.basis
        basisValue = winner.quantity
        snapshot = { type, candidates: evaluated, winner: winner.basis, result: originalAmount }
        break
      }

      const unit = unitForMaxOf(component.basis_unit)
      const quantity = resolveBasisQuantity(unit, basis)
      const rateResult = round(toNumber(component.rate_per_unit) * quantity, 4)
      const minimum = toNumber(component.minimum_amount)
      originalAmount = Math.max(rateResult, minimum)
      calculationBasis = unit
      basisValue = quantity
      snapshot = { type, rate: toNumber(component.rate_per_unit), quantity, minimum, result: originalAmount }
      break
    }

    case CalculationType.PER_VALUE: {
      const valueInCurrency = currency === 'USD' ? basis.cifUsd : basis.cifUsd * exchangeRateUsdToHnl
      originalAmount = round(valueInCurrency * toNumber(component.rate_percentage), 4)
      calculationBasis = currency === 'USD' ? 'CIF_USD' : 'CIF_HNL'
      basisValue = round(valueInCurrency, 4)
      snapshot = {
        type,
        base: calculationBasis,
        base_value: basisValue,
        rate: toNumber(component.rate_percentage),
        result: originalAmount,
      }
      break
    }

    case CalculationType.RANGE_KG:
    case CalculationType.RANGE_LB:
    case CalculationType.RANGE_CFT:
    case CalculationType.RANGE_VALUE: {
      const ranges = (component.tariff_ranges as TariffRangeItem[] | null) ?? []
      let quantity: number

      if (type === CalculationType.RANGE_VALUE) {
        quantity = currency === 'USD' ? basis.cifUsd : basis.cifUsd * exchangeRateUsdToHnl
        calculationBasis = currency === 'USD' ? 'CIF_USD' : 'CIF_HNL'
      } else {
        const unit: Unit = type === CalculationType.RANGE_KG ? 'KG' : type === CalculationType.RANGE_LB ? 'LB' : 'CFT'
        quantity = resolveBasisQuantity(unit, basis)
        calculationBasis = unit
      }

      originalAmount = applyTariffRanges(ranges, quantity)
      basisValue = round(quantity, 4)
      snapshot = { type, ranges, quantity: basisValue, result: originalAmount }
      break
    }
  }

  // Techo universal: si el componente tiene maximum_amount, aplica sin importar
  // el calculation_type (no está atado a MAX_OF en el schema, a diferencia de minimum_amount).
  if (component.maximum_amount !== null && component.maximum_amount !== undefined) {
    const cap = toNumber(component.maximum_amount)
    if (originalAmount > cap) {
      originalAmount = cap
      snapshot = { ...snapshot, capped_by_maximum_amount: cap }
    }
  }

  const amountUsd = toUsd(originalAmount, currency, exchangeRateUsdToHnl)

  return {
    original_amount: round(originalAmount, 4),
    original_currency: currency,
    exchange_rate: currency === 'HNL' ? exchangeRateUsdToHnl : null,
    amount_usd: amountUsd,
    calculation_basis: calculationBasis,
    basis_value: basisValue,
    calculation_snapshot: snapshot,
  }
}
