import { z } from 'zod'
import { QuotationStatus, TransportType } from '@prisma/client'
import { baseListQuerySchema } from '../../shared/schemas/list-query.schema'

const quotationProductSchema = z.object({
  product_id: z.string().uuid('Producto inválido'),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  weight_kg_override: z.number().positive().optional(),
  weight_lb_override: z.number().positive().optional(),
  volume_cft_override: z.number().positive().optional(),
  fob_unit_price: z.number().positive('El precio FOB debe ser mayor a 0'),
})

export const createQuotationSchema = z.object({
  opportunity_id: z.number().int().positive().optional(),
  client_id: z.string().uuid('Cliente inválido'),
  country_id: z.string().uuid('País inválido'),
  transport_type: z.nativeEnum(TransportType),
  consolidator_id: z.string().uuid('Consolidador inválido'),
  customs_agent_id: z.string().uuid('Agente aduanero inválido'),
  pallet_id: z.string().uuid().optional(),
  products: z.array(quotationProductSchema).min(1, 'Debe incluir al menos un producto'),
  other_international_costs: z.number().nonnegative().default(0),
  margin_amount: z.number().nonnegative('El margen no puede ser negativo'),
  // IDs de CustomsAgentTariffComponent con is_optional=true que NO deben aplicar
  // en esta cotización puntual. Un componente no opcional en la lista es un error.
  excluded_component_ids: z.array(z.string().uuid()).optional(),
  observations: z.string().trim().max(2000).optional(),
  internal_notes: z.string().trim().max(2000).optional(),
})

export const updateQuotationSchema = z
  .object({
    products: z.array(quotationProductSchema).min(1).optional(),
    other_international_costs: z.number().nonnegative().optional(),
    margin_amount: z.number().nonnegative().optional(),
    excluded_component_ids: z.array(z.string().uuid()).optional(),
    observations: z.string().trim().max(2000).optional(),
    internal_notes: z.string().trim().max(2000).optional(),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) => Object.keys(data).filter((k) => k !== 'reason').length > 0,
    { message: 'No se envió ningún campo para actualizar' },
  )

export const changeStateSchema = z.object({
  to_status: z.nativeEnum(QuotationStatus),
  reason: z.string().trim().max(2000).optional(),
})

export const listQuotationsQuerySchema = baseListQuerySchema.extend({
  status: z.nativeEnum(QuotationStatus).optional(),
  client_id: z.string().uuid().optional(),
  country_id: z.string().uuid().optional(),
})

export const compareQuerySchema = z.object({
  opportunity_id: z.coerce.number().int().positive(),
})

export const costDetailParamSchema = z.object({
  id: z.string().uuid('ID de cotización inválido'),
  costDetailId: z.string().uuid('ID de línea de costo inválido'),
})

export const overrideCostDetailSchema = z.object({
  amount_usd: z.number().nonnegative('El monto no puede ser negativo'),
  reason: z.string().trim().min(1, 'La razón es requerida para sobreescribir un cálculo').max(2000),
})

export const revertCostDetailSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export type QuotationProductInputDTO = z.infer<typeof quotationProductSchema>
export type CreateQuotationDTO = z.infer<typeof createQuotationSchema>
export type UpdateQuotationDTO = z.infer<typeof updateQuotationSchema>
export type ChangeStateDTO = z.infer<typeof changeStateSchema>
export type ListQuotationsQuery = z.infer<typeof listQuotationsQuerySchema>
export type CompareQuery = z.infer<typeof compareQuerySchema>
export type OverrideCostDetailDTO = z.infer<typeof overrideCostDetailSchema>
export type RevertCostDetailDTO = z.infer<typeof revertCostDetailSchema>
