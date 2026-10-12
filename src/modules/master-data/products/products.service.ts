import type { Product } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import { round } from '../../../shared/utils/round'
import type { PaginatedResult } from '../../../shared/types/pagination'
import { LB_PER_KG as KG_TO_LB } from '../../calculation-engine/constants'
import type { CreateProductDTO, ListProductsQuery, UpdateProductDTO } from './products.schema'

async function findActiveOrThrow(id: string): Promise<Product> {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product || product.deleted_at) {
    throw new NotFoundError('Producto')
  }
  return product
}

export async function listProducts(query: ListProductsQuery): Promise<PaginatedResult<Product>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    deleted_at: null,
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
    ...(query.supplier_id ? { supplier_id: query.supplier_id } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.product.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getProductById(id: string): Promise<Product> {
  return findActiveOrThrow(id)
}

export async function createProduct(input: CreateProductDTO): Promise<Product> {
  const weight_lb = round(input.weight_kg * KG_TO_LB, 3)
  return prisma.product.create({
    data: {
      name: input.name,
      weight_kg: input.weight_kg,
      weight_lb,
      volume_cft: input.volume_cft,
      ...pickDefined(input),
    },
  })
}

export async function updateProduct(id: string, input: UpdateProductDTO): Promise<Product> {
  await findActiveOrThrow(id)
  const data = pickDefined(input)
  const weight_lb = input.weight_kg !== undefined ? round(input.weight_kg * KG_TO_LB, 3) : undefined

  return prisma.product.update({
    where: { id },
    data: { ...data, ...(weight_lb !== undefined ? { weight_lb } : {}) },
  })
}

export async function deleteProduct(id: string): Promise<void> {
  await findActiveOrThrow(id)
  await prisma.product.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } })
}
