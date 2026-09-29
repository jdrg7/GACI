import type { Client } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type { CreateClientDTO, ListClientsQuery, UpdateClientDTO } from './clients.schema'

async function findActiveOrThrow(id: string): Promise<Client> {
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client || client.deleted_at) {
    throw new NotFoundError('Cliente')
  }
  return client
}

export async function listClients(query: ListClientsQuery): Promise<PaginatedResult<Client>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    deleted_at: null,
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
    ...(query.country_id ? { country_id: query.country_id } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.client.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.client.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getClientById(id: string): Promise<Client> {
  return findActiveOrThrow(id)
}

export async function createClient(input: CreateClientDTO): Promise<Client> {
  return prisma.client.create({
    data: { name: input.name, country_id: input.country_id, ...pickDefined(input) },
  })
}

export async function updateClient(id: string, input: UpdateClientDTO): Promise<Client> {
  await findActiveOrThrow(id)
  return prisma.client.update({ where: { id }, data: pickDefined(input) })
}

export async function deleteClient(id: string): Promise<void> {
  await findActiveOrThrow(id)
  await prisma.client.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } })
}
