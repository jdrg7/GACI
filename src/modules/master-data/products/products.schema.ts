import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'

export const listProductsQuerySchema = baseListQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  is_active: booleanQueryParam,
  supplier_id: z.string().uuid().optional(),
})

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  description: z.string().trim().max(2000).optional(),
  sku: z.string().trim().max(100).optional(),
  supplier_id: z.string().uuid('Proveedor inválido').optional(),
  weight_kg: z.number().positive('El peso debe ser mayor a 0'),
  volume_cft: z.number().positive('El volumen debe ser mayor a 0'),
  customs_code: z.string().trim().max(50).optional(),
})

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    sku: z.string().trim().max(100).optional(),
    supplier_id: z.string().uuid().optional(),
    weight_kg: z.number().positive().optional(),
    volume_cft: z.number().positive().optional(),
    customs_code: z.string().trim().max(50).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>
export type CreateProductDTO = z.infer<typeof createProductSchema>
export type UpdateProductDTO = z.infer<typeof updateProductSchema>
