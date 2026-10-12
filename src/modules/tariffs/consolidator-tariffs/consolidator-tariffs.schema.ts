import { z } from 'zod'
import { TransportType } from '@prisma/client'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'
import { tariffComponentValueSchema } from '../shared/tariff-component-value.schema'

export const listConsolidatorTariffsQuerySchema = baseListQuerySchema.extend({
  consolidator_id: z.string().uuid().optional(),
  country_id: z.string().uuid().optional(),
  transport_type: z.nativeEnum(TransportType).optional(),
  is_active: booleanQueryParam,
})

export const activeConsolidatorTariffQuerySchema = z.object({
  consolidator_id: z.string().uuid(),
  country_id: z.string().uuid(),
  transport_type: z.nativeEnum(TransportType),
})

export const createConsolidatorTariffSchema = z.object({
  consolidator_id: z.string().uuid('Consolidador inválido'),
  country_id: z.string().uuid('País inválido'),
  transport_type: z.nativeEnum(TransportType),
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const updateConsolidatorTariffSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    valid_until: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export const consolidatorTariffComponentSchema = tariffComponentValueSchema.and(
  z.object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(255),
    sort_order: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
)

export const componentParamSchema = z.object({
  id: z.string().uuid('ID de tarifa inválido'),
  componentId: z.string().uuid('ID de componente inválido'),
})

export type ListConsolidatorTariffsQuery = z.infer<typeof listConsolidatorTariffsQuerySchema>
export type ActiveConsolidatorTariffQuery = z.infer<typeof activeConsolidatorTariffQuerySchema>
export type CreateConsolidatorTariffDTO = z.infer<typeof createConsolidatorTariffSchema>
export type UpdateConsolidatorTariffDTO = z.infer<typeof updateConsolidatorTariffSchema>
export type ConsolidatorTariffComponentDTO = z.infer<typeof consolidatorTariffComponentSchema>
