import type { Request, Response } from 'express'
import { prisma } from '../../../config/database'
import { sendSuccess } from '../../../shared/utils/response'

export async function list(_req: Request, res: Response): Promise<void> {
  const currencies = await prisma.currency.findMany({ orderBy: { code: 'asc' } })
  sendSuccess(res, currencies)
}
