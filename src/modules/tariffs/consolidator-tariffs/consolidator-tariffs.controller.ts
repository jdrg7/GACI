import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import { AuthError } from '../../../shared/errors'
import * as tariffsService from './consolidator-tariffs.service'
import type {
  ActiveConsolidatorTariffQuery,
  ConsolidatorTariffComponentDTO,
  CreateConsolidatorTariffDTO,
  ListConsolidatorTariffsQuery,
  UpdateConsolidatorTariffDTO,
} from './consolidator-tariffs.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListConsolidatorTariffsQuery
  const result = await tariffsService.listTariffs(query)
  sendPaginated(res, result.data, result.meta)
}

export async function active(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ActiveConsolidatorTariffQuery
  const tariff = await tariffsService.getActiveTariff(query)
  sendSuccess(res, tariff)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const tariff = await tariffsService.getTariffById(id)
  sendSuccess(res, tariff)
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AuthError()
  const input = req.body as CreateConsolidatorTariffDTO
  const tariff = await tariffsService.createTariff(input, req.user.id)
  sendSuccess(res, tariff, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdateConsolidatorTariffDTO
  const tariff = await tariffsService.updateTariff(id, input)
  sendSuccess(res, tariff)
}

export async function addComponent(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as ConsolidatorTariffComponentDTO
  const component = await tariffsService.addComponent(id, input)
  sendSuccess(res, component, 201)
}

export async function updateComponent(req: Request, res: Response): Promise<void> {
  const { id, componentId } = req.params as { id: string; componentId: string }
  const input = req.body as ConsolidatorTariffComponentDTO
  const component = await tariffsService.updateComponent(id, componentId, input)
  sendSuccess(res, component)
}

export async function deleteComponent(req: Request, res: Response): Promise<void> {
  const { id, componentId } = req.params as { id: string; componentId: string }
  await tariffsService.deleteComponent(id, componentId)
  sendSuccess(res, { message: 'Componente eliminado' })
}
