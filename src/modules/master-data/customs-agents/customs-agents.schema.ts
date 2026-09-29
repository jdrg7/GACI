import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'

export const listCustomsAgentsQuerySchema = baseListQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  is_active: booleanQueryParam,
})

export const createCustomsAgentSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  description: z.string().trim().max(2000).optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().trim().max(50).optional(),
  license_number: z.string().trim().max(100).optional(),
})

export const updateCustomsAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().trim().max(50).optional(),
    license_number: z.string().trim().max(100).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export type ListCustomsAgentsQuery = z.infer<typeof listCustomsAgentsQuerySchema>
export type CreateCustomsAgentDTO = z.infer<typeof createCustomsAgentSchema>
export type UpdateCustomsAgentDTO = z.infer<typeof updateCustomsAgentSchema>
