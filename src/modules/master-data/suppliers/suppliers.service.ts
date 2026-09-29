import type { Supplier } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type { CreateSupplierDTO, ListSuppliersQuery, UpdateSupplierDTO } from './suppliers.schema'

async function findActiveOrThrow(id: string): Promise<Supplier> {
  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier || supplier.deleted_at) {
    throw new NotFoundError('Proveedor')
  }
  return supplier
}

export async function listSuppliers(query: ListSuppliersQuery): Promise<PaginatedResult<Supplier>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    deleted_at: null,
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getSupplierById(id: string): Promise<Supplier> {
  return findActiveOrThrow(id)
}

export async function createSupplier(input: CreateSupplierDTO): Promise<Supplier> {
  return prisma.supplier.create({ data: { name: input.name, ...pickDefined(input) } })
}

export async function updateSupplier(id: string, input: UpdateSupplierDTO): Promise<Supplier> {
  await findActiveOrThrow(id)
  return prisma.supplier.update({ where: { id }, data: pickDefined(input) })
}

export async function deleteSupplier(id: string): Promise<void> {
  await findActiveOrThrow(id)
  await prisma.supplier.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } })
}
