import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'

export const listCountriesQuerySchema = baseListQuerySchema.extend({
  is_active: booleanQueryParam,
})

export const createCountrySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(3)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, 'El nombre es requerido').max(100),
  currency_id: z.string().uuid('Moneda inválida'),
})

export const updateCountrySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    currency_id: z.string().uuid().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export type ListCountriesQuery = z.infer<typeof listCountriesQuerySchema>
export type CreateCountryDTO = z.infer<typeof createCountrySchema>
export type UpdateCountryDTO = z.infer<typeof updateCountrySchema>
