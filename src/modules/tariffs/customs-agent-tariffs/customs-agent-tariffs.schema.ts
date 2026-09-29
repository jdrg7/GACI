import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'
import { booleanQueryParam } from '../../../shared/schemas/boolean-query.schema'
import { tariffComponentValueSchema } from '../shared/tariff-component-value.schema'

export const listCustomsAgentTariffsQuerySchema = baseListQuerySchema.extend({
  customs_agent_id: z.string().uuid().optional(),
  country_id: z.string().uuid().optional(),
  is_active: booleanQueryParam,
})

export const activeCustomsAgentTariffQuerySchema = z.object({
  customs_agent_id: z.string().uuid(),
  country_id: z.string().uuid(),
})

export const createCustomsAgentTariffSchema = z.object({
  customs_agent_id: z.string().uuid('Agente aduanero inválido'),
  country_id: z.string().uuid('País inválido'),
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const updateCustomsAgentTariffSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    valid_until: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export const customsAgentTariffComponentSchema = tariffComponentValueSchema.and(
  z.object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(255),
    sort_order: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
    is_optional: z.boolean().optional(),
  }),
)

export const componentParamSchema = z.object({
  id: z.string().uuid('ID de tarifa inválido'),
  componentId: z.string().uuid('ID de componente inválido'),
})

export type ListCustomsAgentTariffsQuery = z.infer<typeof listCustomsAgentTariffsQuerySchema>
export type ActiveCustomsAgentTariffQuery = z.infer<typeof activeCustomsAgentTariffQuerySchema>
export type CreateCustomsAgentTariffDTO = z.infer<typeof createCustomsAgentTariffSchema>
export type UpdateCustomsAgentTariffDTO = z.infer<typeof updateCustomsAgentTariffSchema>
export type CustomsAgentTariffComponentDTO = z.infer<typeof customsAgentTariffComponentSchema>
