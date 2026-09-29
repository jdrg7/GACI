import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import * as suppliersService from './suppliers.service'
import type { CreateSupplierDTO, ListSuppliersQuery, UpdateSupplierDTO } from './suppliers.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListSuppliersQuery
  const result = await suppliersService.listSuppliers(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const supplier = await suppliersService.getSupplierById(id)
  sendSuccess(res, supplier)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateSupplierDTO
  const supplier = await suppliersService.createSupplier(input)
  sendSuccess(res, supplier, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdateSupplierDTO
  const supplier = await suppliersService.updateSupplier(id, input)
  sendSuccess(res, supplier)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  await suppliersService.deleteSupplier(id)
  sendSuccess(res, { message: 'Proveedor eliminado' })
}
