import type { PaginationMeta } from '../types/pagination'

export function getPagination(params: { page: number; limit: number }): {
  skip: number
  take: number
  page: number
  limit: number
} {
  const page = Math.max(1, params.page)
  const limit = Math.max(1, params.limit)
  return { skip: (page - 1) * limit, take: limit, page, limit }
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return { total, page, limit, totalPages: Math.ceil(total / limit) }
}
