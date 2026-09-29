import type { Consolidator } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type {
  CreateConsolidatorDTO,
  ListConsolidatorsQuery,
  UpdateConsolidatorDTO,
} from './consolidators.schema'

async function findActiveOrThrow(id: string): Promise<Consolidator> {
  const consolidator = await prisma.consolidator.findUnique({ where: { id } })
  if (!consolidator || consolidator.deleted_at) {
    throw new NotFoundError('Consolidador')
  }
  return consolidator
}

export async function listConsolidators(
  query: ListConsolidatorsQuery,
): Promise<PaginatedResult<Consolidator>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    deleted_at: null,
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.consolidator.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.consolidator.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getConsolidatorById(id: string): Promise<Consolidator> {
  return findActiveOrThrow(id)
}

export async function createConsolidator(input: CreateConsolidatorDTO): Promise<Consolidator> {
  return prisma.consolidator.create({ data: { name: input.name, ...pickDefined(input) } })
}

export async function updateConsolidator(
  id: string,
  input: UpdateConsolidatorDTO,
): Promise<Consolidator> {
  await findActiveOrThrow(id)
  return prisma.consolidator.update({ where: { id }, data: pickDefined(input) })
}

export async function deleteConsolidator(id: string): Promise<void> {
  await findActiveOrThrow(id)
  await prisma.consolidator.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  })
}
