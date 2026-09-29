import { round } from '../../shared/utils/round'

const INSURANCE_RATE = 0.0035 // 0.35% sobre FOB

export function calculateInsurance(fobUsd: number): number {
  return round(fobUsd * INSURANCE_RATE, 4)
}
