import { z } from 'zod'
import { baseListQuerySchema } from '../../../shared/schemas/list-query.schema'

const currencyCode = z
  .string()
  .trim()
  .length(3, 'Código de moneda inválido')
  .transform((value) => value.toUpperCase())

export const listExchangeRatesQuerySchema = baseListQuerySchema.extend({
  from: currencyCode.optional(),
  to: currencyCode.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export const latestExchangeRateQuerySchema = z.object({
  from: currencyCode,
  to: currencyCode,
})

export const createExchangeRateSchema = z.object({
  from: currencyCode,
  to: currencyCode,
  rate: z.number().positive('La tasa debe ser mayor a 0'),
  date: z.coerce.date(),
})

export type ListExchangeRatesQuery = z.infer<typeof listExchangeRatesQuerySchema>
export type LatestExchangeRateQuery = z.infer<typeof latestExchangeRateQuerySchema>
export type CreateExchangeRateDTO = z.infer<typeof createExchangeRateSchema>
