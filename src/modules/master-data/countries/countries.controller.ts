import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../../shared/utils/response'
import * as countriesService from './countries.service'
import type { CreateCountryDTO, ListCountriesQuery, UpdateCountryDTO } from './countries.schema'

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListCountriesQuery
  const result = await countriesService.listCountries(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const country = await countriesService.getCountryById(id)
  sendSuccess(res, country)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateCountryDTO
  const country = await countriesService.createCountry(input)
  sendSuccess(res, country, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const input = req.body as UpdateCountryDTO
  const country = await countriesService.updateCountry(id, input)
  sendSuccess(res, country)
}
