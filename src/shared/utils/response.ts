import type { Response } from 'express'
import type { PaginationMeta } from '../types/pagination'

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data })
}

export function sendPaginated<T>(res: Response, data: T[], meta: PaginationMeta): Response {
  return res.status(200).json({ success: true, data, meta })
}
