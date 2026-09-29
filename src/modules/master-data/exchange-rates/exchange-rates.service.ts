import type { ExchangeRate } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError, ValidationError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type {
  CreateExchangeRateDTO,
  LatestExchangeRateQuery,
  ListExchangeRatesQuery,
} from './exchange-rates.schema'

async function resolveCurrencyId(code: string): Promise<string> {
  const currency = await prisma.currency.findUnique({ where: { code } })
  if (!currency) {
    throw new ValidationError('Moneda inválida', [{ field: 'code', message: `No existe la moneda ${code}` }])
  }
  return currency.id
}

export async function listExchangeRates(
  query: ListExchangeRatesQuery,
): Promise<PaginatedResult<ExchangeRate>> {
  const { skip, take, page, limit } = getPagination(query)

  const [fromId, toId] = await Promise.all([
    query.from ? resolveCurrencyId(query.from) : undefined,
    query.to ? resolveCurrencyId(query.to) : undefined,
  ])

  const where = {
    ...(fromId ? { from_currency_id: fromId } : {}),
    ...(toId ? { to_currency_id: toId } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          date: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  }

  const [data, total] = await Promise.all([
    prisma.exchangeRate.findMany({ where, skip, take, orderBy: { date: 'desc' } }),
    prisma.exchangeRate.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getLatestExchangeRate(
  query: LatestExchangeRateQuery,
): Promise<ExchangeRate> {
  const [fromId, toId] = await Promise.all([
    resolveCurrencyId(query.from),
    resolveCurrencyId(query.to),
  ])

  const rate = await prisma.exchangeRate.findFirst({
    where: { from_currency_id: fromId, to_currency_id: toId },
    orderBy: { date: 'desc' },
  })

  if (!rate) {
    throw new NotFoundError(`Tipo de cambio ${query.from}→${query.to}`)
  }

  return rate
}

export async function createExchangeRate(
  input: CreateExchangeRateDTO,
  createdBy: string,
): Promise<ExchangeRate> {
  if (input.from === input.to) {
    throw new ValidationError('La moneda de origen y destino no pueden ser la misma')
  }

  const [fromId, toId] = await Promise.all([
    resolveCurrencyId(input.from),
    resolveCurrencyId(input.to),
  ])

  return prisma.exchangeRate.create({
    data: {
      from_currency_id: fromId,
      to_currency_id: toId,
      rate: input.rate,
      date: input.date,
      created_by: createdBy,
    },
  })
}
