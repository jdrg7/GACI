import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import { AuthError } from '../../../shared/errors'
import * as exchangeRatesService from './exchange-rates.service'
import type {
  CreateExchangeRateDTO,
  LatestExchangeRateQuery,
  ListExchangeRatesQuery,
} from './exchange-rates.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListExchangeRatesQuery
  const result = await exchangeRatesService.listExchangeRates(query)
  sendPaginated(res, result.data, result.meta)
}

export async function latest(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as LatestExchangeRateQuery
  const rate = await exchangeRatesService.getLatestExchangeRate(query)
  sendSuccess(res, rate)
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AuthError()
  const input = req.body as CreateExchangeRateDTO
  const rate = await exchangeRatesService.createExchangeRate(input, req.user.id)
  sendSuccess(res, rate, 201)
}
