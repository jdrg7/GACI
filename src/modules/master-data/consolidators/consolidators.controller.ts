import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import * as consolidatorsService from './consolidators.service'
import type {
  CreateConsolidatorDTO,
  ListConsolidatorsQuery,
  UpdateConsolidatorDTO,
} from './consolidators.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListConsolidatorsQuery
  const result = await consolidatorsService.listConsolidators(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const consolidator = await consolidatorsService.getConsolidatorById(id)
  sendSuccess(res, consolidator)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateConsolidatorDTO
  const consolidator = await consolidatorsService.createConsolidator(input)
  sendSuccess(res, consolidator, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdateConsolidatorDTO
  const consolidator = await consolidatorsService.updateConsolidator(id, input)
  sendSuccess(res, consolidator)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  await consolidatorsService.deleteConsolidator(id)
  sendSuccess(res, { message: 'Consolidador eliminado' })
}
