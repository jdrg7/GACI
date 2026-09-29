import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import * as clientsService from './clients.service'
import type { CreateClientDTO, ListClientsQuery, UpdateClientDTO } from './clients.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListClientsQuery
  const result = await clientsService.listClients(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const client = await clientsService.getClientById(id)
  sendSuccess(res, client)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateClientDTO
  const client = await clientsService.createClient(input)
  sendSuccess(res, client, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdateClientDTO
  const client = await clientsService.updateClient(id, input)
  sendSuccess(res, client)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  await clientsService.deleteClient(id)
  sendSuccess(res, { message: 'Cliente eliminado' })
}
