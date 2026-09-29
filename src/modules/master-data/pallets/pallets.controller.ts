import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import * as palletsService from './pallets.service'
import type { CreatePalletDTO, ListPalletsQuery, UpdatePalletDTO } from './pallets.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListPalletsQuery
  const result = await palletsService.listPallets(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const pallet = await palletsService.getPalletById(id)
  sendSuccess(res, pallet)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreatePalletDTO
  const pallet = await palletsService.createPallet(input)
  sendSuccess(res, pallet, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdatePalletDTO
  const pallet = await palletsService.updatePallet(id, input)
  sendSuccess(res, pallet)
}
