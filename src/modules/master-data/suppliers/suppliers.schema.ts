import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'

export const listSuppliersQuerySchema = baseListQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  is_active: booleanQueryParam,
})

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().trim().max(50).optional(),
  country: z.string().trim().max(100).optional(),
})

export const updateSupplierSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().trim().max(50).optional(),
    country: z.string().trim().max(100).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>
export type CreateSupplierDTO = z.infer<typeof createSupplierSchema>
export type UpdateSupplierDTO = z.infer<typeof updateSupplierSchema>
