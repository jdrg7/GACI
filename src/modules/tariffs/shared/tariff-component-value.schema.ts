import { z } from 'zod'
import { CalculationType, TariffBasis } from '@prisma/client'
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

// Campos de "valor" de un componente de tarifa: cuáles son requeridos depende
// de `calculation_type` (ver tabla documentada en el plan / schema.prisma).
export const tariffComponentValueSchema = z
  .object({
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
  .superRefine((data, ctx) => {
    const requireField = (field: keyof typeof data, message: string): void => {
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
      requireField('rate_per_unit', 'rate_per_unit es requerido para MAX_OF')
      requireField('minimum_amount', 'minimum_amount es requerido para MAX_OF')
      requireField('basis_unit', 'basis_unit es requerido para MAX_OF (KG, LB o CFT)')
    } else if (RANGE_TYPES.has(data.calculation_type)) {
      requireField('tariff_ranges', `tariff_ranges es requerido para ${data.calculation_type}`)
    }
  })

export type TariffComponentValue = z.infer<typeof tariffComponentValueSchema>
