import { round } from '../../shared/utils/round'

export interface TariffRangeItem {
  from: number
  to: number | null
  type: 'fixed' | 'per_unit' | 'base_plus' | 'block_ceil' | 'per_value'
  amount?: number
  rate?: number
  base?: number
  base_from?: number
  block_size?: number
  min?: number
}

/**
 * Calcula el monto de un componente de tarifa progresivo (RANGE_KG/LB/CFT/VALUE)
 * dada una cantidad (peso, volumen o valor monetario según el componente).
 *
 * Verificado a mano contra los dos casos documentados en schema.prisma:
 *   - Supervisión y Registro (RANGE_KG): 300 KG → L220
 *   - Honorarios/Manejo de Mercadería (RANGE_VALUE): CIF L351,997.14 → L4,140.9857
 *
 * Reglas:
 *   - El "tramo actual" es el primero (en orden ascendente de `from`) cuyo `to`
 *     sea null o `quantity <= to`.
 *   - Si el tramo actual es `fixed`/`base_plus`/`block_ceil`: fórmula cerrada,
 *     autocontenida (no se suman los tramos anteriores).
 *   - Si el tramo actual es `per_unit`/`per_value`: se SUMAN las contribuciones
 *     de todos los tramos desde el primero hasta el actual (cálculo progresivo).
 */
export function applyTariffRanges(rangesInput: TariffRangeItem[], quantity: number): number {
  const ranges = [...rangesInput].sort((a, b) => a.from - b.from)

  const currentIndex = ranges.findIndex((range) => range.to === null || quantity <= range.to)
  if (currentIndex === -1) {
    // La cantidad excede todos los tramos definidos (dato de tarifa incompleto).
    return 0
  }

  const current = ranges[currentIndex]!

  switch (current.type) {
    case 'fixed':
      return round(current.amount ?? 0, 4)

    case 'base_plus':
      return round((current.base ?? 0) + (quantity - (current.base_from ?? 0)) * (current.rate ?? 0), 4)

    case 'block_ceil': {
      const blockSize = current.block_size ?? 1
      const blocks = Math.ceil((quantity - (current.base_from ?? 0)) / blockSize)
      return round((current.base ?? 0) + blocks * (current.rate ?? 0), 4)
    }

    case 'per_unit':
    case 'per_value': {
      let total = 0
      for (let i = 0; i <= currentIndex; i++) {
        const tier = ranges[i]!
        if (tier.type === 'fixed') {
          total += tier.amount ?? 0
        } else if (tier.type === 'per_unit' || tier.type === 'per_value') {
          const upperBound = tier.to === null ? quantity : Math.min(quantity, tier.to)
          const width = Math.max(0, upperBound - tier.from)
          let contribution = width * (tier.rate ?? 0)
          if (tier.min !== undefined) {
            contribution = Math.max(contribution, tier.min)
          }
          total += contribution
        }
        // tramos base_plus/block_ceil no deberían mezclarse con tramos
        // per_unit/per_value dentro del mismo arreglo; se ignoran si aparecen.
      }
      return round(total, 4)
    }

    default:
      return 0
  }
}
