import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'

export const listClientsQuerySchema = baseListQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  is_active: booleanQueryParam,
  country_id: z.string().uuid().optional(),
})

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  tax_id: z.string().trim().max(50).optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(2000).optional(),
  country_id: z.string().uuid('País inválido'),
})

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    tax_id: z.string().trim().max(50).optional(),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().trim().max(50).optional(),
    address: z.string().trim().max(2000).optional(),
    country_id: z.string().uuid().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>
export type CreateClientDTO = z.infer<typeof createClientSchema>
export type UpdateClientDTO = z.infer<typeof updateClientSchema>
