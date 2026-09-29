import type { CustomsAgent } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type {
  CreateCustomsAgentDTO,
  ListCustomsAgentsQuery,
  UpdateCustomsAgentDTO,
} from './customs-agents.schema'

async function findActiveOrThrow(id: string): Promise<CustomsAgent> {
  const agent = await prisma.customsAgent.findUnique({ where: { id } })
  if (!agent || agent.deleted_at) {
    throw new NotFoundError('Agente aduanero')
  }
  return agent
}

export async function listCustomsAgents(
  query: ListCustomsAgentsQuery,
): Promise<PaginatedResult<CustomsAgent>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    deleted_at: null,
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.customsAgent.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.customsAgent.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getCustomsAgentById(id: string): Promise<CustomsAgent> {
  return findActiveOrThrow(id)
}

export async function createCustomsAgent(input: CreateCustomsAgentDTO): Promise<CustomsAgent> {
  return prisma.customsAgent.create({ data: { name: input.name, ...pickDefined(input) } })
}

export async function updateCustomsAgent(
  id: string,
  input: UpdateCustomsAgentDTO,
): Promise<CustomsAgent> {
  await findActiveOrThrow(id)
  return prisma.customsAgent.update({ where: { id }, data: pickDefined(input) })
}

export async function deleteCustomsAgent(id: string): Promise<void> {
  await findActiveOrThrow(id)
  await prisma.customsAgent.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  })
}
