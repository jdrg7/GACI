import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'

export const listPalletsQuerySchema = baseListQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  is_active: booleanQueryParam,
})

export const createPalletSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100),
  description: z.string().trim().max(2000).optional(),
  max_weight_kg: z.number().positive('El peso máximo debe ser mayor a 0'),
  length_cm: z.number().positive(),
  width_cm: z.number().positive(),
  height_cm: z.number().positive(),
  volume_cft: z.number().positive(),
})

export const updatePalletSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    max_weight_kg: z.number().positive().optional(),
    length_cm: z.number().positive().optional(),
    width_cm: z.number().positive().optional(),
    height_cm: z.number().positive().optional(),
    volume_cft: z.number().positive().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export type ListPalletsQuery = z.infer<typeof listPalletsQuerySchema>
export type CreatePalletDTO = z.infer<typeof createPalletSchema>
export type UpdatePalletDTO = z.infer<typeof updatePalletSchema>
