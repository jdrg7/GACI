import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'

export const listConsolidatorsQuerySchema = baseListQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  is_active: booleanQueryParam,
})

export const createConsolidatorSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  description: z.string().trim().max(2000).optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().trim().max(50).optional(),
})

export const updateConsolidatorSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().trim().max(50).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export type ListConsolidatorsQuery = z.infer<typeof listConsolidatorsQuerySchema>
export type CreateConsolidatorDTO = z.infer<typeof createConsolidatorSchema>
export type UpdateConsolidatorDTO = z.infer<typeof updateConsolidatorSchema>
