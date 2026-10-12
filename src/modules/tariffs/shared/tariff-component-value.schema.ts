import { z } from 'zod'
import { CalculationType, ServiceLevel, TariffBasis } from '@prisma/client'
import { tariffRangesSchema } from './tariff-range.schema'

const RANGE_TYPES = new Set<CalculationType>([
  CalculationType.RANGE_KG,
  CalculationType.RANGE_LB,
  CalculationType.RANGE_CFT,
  CalculationType.RANGE_VALUE,
])

const PER_UNIT_TYPES = new Set<CalculationType>([
  CalculationType.PER_KG,
  CalculationType.PER_LB,
  CalculationType.PER_CFT,
])

// Base candidata de un MAX_OF multi-base: el componente cobra el mayor entre todas
// (cada una con su tarifa y mínimo). VOL_KG/VOL_LB son el peso volumétrico.
export const basisCandidateSchema = z.object({
  basis: z.enum(['KG', 'LB', 'CFT', 'VOL_KG', 'VOL_LB']),
  rate: z.number().positive('La tarifa debe ser mayor a 0'),
  minimum: z.number().nonnegative().optional(),
})

export const basisCandidatesSchema = z.array(basisCandidateSchema).min(1, 'Debe haber al menos una base candidata')

// Campos de "valor" de un componente de tarifa (sin reglas cruzadas todavía).
export const tariffComponentValueObject = z.object({
  calculation_type: z.nativeEnum(CalculationType),
  currency_id: z.string().uuid('Moneda inválida'),
  fixed_amount: z.number().positive().optional(),
  rate_per_unit: z.number().positive().optional(),
  rate_percentage: z.number().positive().max(10, 'Porcentaje fuera de rango razonable').optional(),
  minimum_amount: z.number().positive().optional(),
  maximum_amount: z.number().positive().optional(),
  tariff_ranges: tariffRangesSchema.optional(),
  basis_unit: z.nativeEnum(TariffBasis).optional(),
})

// Campos exclusivos de los componentes del consolidador.
export const consolidatorComponentExtraObject = z.object({
  basis_candidates: basisCandidatesSchema.optional(),
  service_level: z.nativeEnum(ServiceLevel).optional(),
})

interface RefinableValue {
  calculation_type: CalculationType
  fixed_amount?: number | undefined
  rate_per_unit?: number | undefined
  rate_percentage?: number | undefined
  minimum_amount?: number | undefined
  tariff_ranges?: unknown
  basis_unit?: TariffBasis | undefined
  basis_candidates?: unknown
}

// Cuáles campos son requeridos depende de `calculation_type` (ver schema.prisma).
export function refineTariffComponentValue(data: RefinableValue, ctx: z.RefinementCtx): void {
  const requireField = (field: keyof RefinableValue, message: string): void => {
    if (data[field] === undefined) {
      ctx.addIssue({ code: 'custom', path: [field], message })
    }
  }

  if (data.calculation_type === CalculationType.FIXED) {
    requireField('fixed_amount', 'fixed_amount es requerido para FIXED')
  } else if (PER_UNIT_TYPES.has(data.calculation_type)) {
    requireField('rate_per_unit', `rate_per_unit es requerido para ${data.calculation_type}`)
  } else if (data.calculation_type === CalculationType.PER_VALUE) {
    requireField('rate_percentage', 'rate_percentage es requerido para PER_VALUE')
  } else if (data.calculation_type === CalculationType.MAX_OF) {
    // Con bases candidatas, cada una trae su tarifa y mínimo: no hace falta la forma de una sola base.
    if (data.basis_candidates === undefined) {
      requireField('rate_per_unit', 'rate_per_unit es requerido para MAX_OF')
      requireField('minimum_amount', 'minimum_amount es requerido para MAX_OF')
      requireField('basis_unit', 'basis_unit es requerido para MAX_OF (KG, LB o CFT)')
    }
  } else if (RANGE_TYPES.has(data.calculation_type)) {
    requireField('tariff_ranges', `tariff_ranges es requerido para ${data.calculation_type}`)
  }

  if (data.basis_candidates !== undefined && data.calculation_type !== CalculationType.MAX_OF) {
    ctx.addIssue({
      code: 'custom',
      path: ['basis_candidates'],
      message: 'basis_candidates solo aplica a componentes MAX_OF',
    })
  }
}

export const tariffComponentValueSchema = tariffComponentValueObject.superRefine(refineTariffComponentValue)

export type TariffComponentValue = z.infer<typeof tariffComponentValueSchema>
