import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import * as customsAgentsService from './customs-agents.service'
import type {
  CreateCustomsAgentDTO,
  ListCustomsAgentsQuery,
  UpdateCustomsAgentDTO,
} from './customs-agents.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListCustomsAgentsQuery
  const result = await customsAgentsService.listCustomsAgents(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const agent = await customsAgentsService.getCustomsAgentById(id)
  sendSuccess(res, agent)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateCustomsAgentDTO
  const agent = await customsAgentsService.createCustomsAgent(input)
  sendSuccess(res, agent, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdateCustomsAgentDTO
  const agent = await customsAgentsService.updateCustomsAgent(id, input)
  sendSuccess(res, agent)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  await customsAgentsService.deleteCustomsAgent(id)
  sendSuccess(res, { message: 'Agente aduanero eliminado' })
}
