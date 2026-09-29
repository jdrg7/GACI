import { round } from '../../shared/utils/round'

/**
 * Convierte un monto a USD. Solo participan USD y HNL en cotizaciones
 * (confirmado por el seed y el caso de negocio de referencia).
 * `exchangeRateUsdToHnl` es la tasa USD→HNL (ej. 27.004).
 */
export function toUsd(amount: number, currencyCode: string, exchangeRateUsdToHnl: number): number {
  if (currencyCode === 'USD') return round(amount, 4)
  if (currencyCode === 'HNL') return round(amount / exchangeRateUsdToHnl, 4)
  throw new Error(`Moneda no soportada en cotizaciones: ${currencyCode}`)
}
