import type { Pallet } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type { CreatePalletDTO, ListPalletsQuery, UpdatePalletDTO } from './pallets.schema'

async function findOrThrow(id: string): Promise<Pallet> {
  const pallet = await prisma.pallet.findUnique({ where: { id } })
  if (!pallet) {
    throw new NotFoundError('Pallet')
  }
  return pallet
}

export async function listPallets(query: ListPalletsQuery): Promise<PaginatedResult<Pallet>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.pallet.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.pallet.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getPalletById(id: string): Promise<Pallet> {
  return findOrThrow(id)
}

export async function createPallet(input: CreatePalletDTO): Promise<Pallet> {
  return prisma.pallet.create({
    data: {
      name: input.name,
      max_weight_kg: input.max_weight_kg,
      length_cm: input.length_cm,
      width_cm: input.width_cm,
      height_cm: input.height_cm,
      volume_cft: input.volume_cft,
      ...pickDefined(input),
    },
  })
}

export async function updatePallet(id: string, input: UpdatePalletDTO): Promise<Pallet> {
  await findOrThrow(id)
  return prisma.pallet.update({ where: { id }, data: pickDefined(input) })
}
