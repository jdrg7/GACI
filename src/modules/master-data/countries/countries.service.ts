import type { Country } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type { CreateCountryDTO, ListCountriesQuery, UpdateCountryDTO } from './countries.schema'

async function findOrThrow(id: string): Promise<Country> {
  const country = await prisma.country.findUnique({ where: { id } })
  if (!country) {
    throw new NotFoundError('País')
  }
  return country
}

export async function listCountries(query: ListCountriesQuery): Promise<PaginatedResult<Country>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.country.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.country.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getCountryById(id: string): Promise<Country> {
  return findOrThrow(id)
}

export async function createCountry(input: CreateCountryDTO): Promise<Country> {
  return prisma.country.create({
    data: { code: input.code, name: input.name, currency_id: input.currency_id },
  })
}

export async function updateCountry(id: string, input: UpdateCountryDTO): Promise<Country> {
  await findOrThrow(id)
  return prisma.country.update({ where: { id }, data: pickDefined(input) })
}
