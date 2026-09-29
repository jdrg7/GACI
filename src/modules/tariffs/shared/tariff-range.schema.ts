import { z } from 'zod'

const rangeItemTypes = ['fixed', 'per_unit', 'base_plus', 'block_ceil', 'per_value'] as const

export const tariffRangeItemSchema = z
  .object({
    from: z.number().nonnegative(),
    to: z.number().positive().nullable(),
    type: z.enum(rangeItemTypes),
    amount: z.number().optional(),
    rate: z.number().optional(),
    base: z.number().optional(),
    base_from: z.number().optional(),
    block_size: z.number().positive().optional(),
    min: z.number().optional(),
  })
  .superRefine((range, ctx) => {
    const require = (field: 'amount' | 'rate' | 'base' | 'base_from' | 'block_size'): void => {
      if (range[field] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `"${field}" es requerido para un tramo de tipo "${range.type}"`,
        })
      }
    }

    switch (range.type) {
      case 'fixed':
        require('amount')
        break
      case 'per_unit':
        require('rate')
        break
      case 'base_plus':
        require('base')
        require('rate')
        require('base_from')
        break
      case 'block_ceil':
        require('base')
        require('rate')
        require('block_size')
        require('base_from')
        break
      case 'per_value':
        require('rate')
        break
    }
  })

export const tariffRangesSchema = z
  .array(tariffRangeItemSchema)
  .min(1, 'Debe incluir al menos un tramo')
  .refine(
    (ranges) => ranges.every((range, index) => index === 0 || range.from >= ranges[index - 1]!.from),
    { message: 'Los tramos deben estar ordenados por "from" ascendente' },
  )

export type TariffRangeItem = z.infer<typeof tariffRangeItemSchema>
