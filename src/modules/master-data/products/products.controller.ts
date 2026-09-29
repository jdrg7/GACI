import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import * as productsService from './products.service'
import type { CreateProductDTO, ListProductsQuery, UpdateProductDTO } from './products.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListProductsQuery
  const result = await productsService.listProducts(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const product = await productsService.getProductById(id)
  sendSuccess(res, product)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateProductDTO
  const product = await productsService.createProduct(input)
  sendSuccess(res, product, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdateProductDTO
  const product = await productsService.updateProduct(id, input)
  sendSuccess(res, product)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  await productsService.deleteProduct(id)
  sendSuccess(res, { message: 'Producto eliminado' })
}
