import type { Request, Response } from 'express'
import { Permission } from '@prisma/client'
import { sendPaginated, sendSuccess } from '../../shared/utils/response'
import { AuthError, ValidationError } from '../../shared/errors'
import * as quotationsService from './quotations.service'
import type {
  ChangeStateDTO,
  CompareQuery,
  CreateQuotationDTO,
  ListQuotationsQuery,
  OverrideCostDetailDTO,
  RevertCostDetailDTO,
  UpdateQuotationDTO,
} from './quotations.schema'

function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new AuthError()
  return req.user
}

function getMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  return { ipAddress: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null }
}

// El OPP solo se expone a quien tiene QUOTATION_VIEW_OPP (ej. Operaciones no).
function stripOpp<T extends { opportunity_id: number | null }>(quotation: T, canView: boolean): T {
  if (canView) return quotation
  return { ...quotation, opportunity_id: null }
}

export async function create(req: Request, res: Response): Promise<void> {
  const user = requireUser(req)
  const input = req.body as CreateQuotationDTO

  if (input.opportunity_id !== undefined && !user.permissions.includes(Permission.QUOTATION_VIEW_OPP)) {
    throw new ValidationError('No tienes permiso para asignar un número de OPP; crea la cotización sin él')
  }

  const quotation = await quotationsService.createQuotation(input, user.id)
  sendSuccess(res, stripOpp(quotation, user.permissions.includes(Permission.QUOTATION_VIEW_OPP)), 201)
}

export async function list(req: Request, res: Response): Promise<void> {
  const user = requireUser(req)
  const query = req.query as unknown as ListQuotationsQuery
  const result = await quotationsService.listQuotations(query, user)
  const canViewOpp = user.permissions.includes(Permission.QUOTATION_VIEW_OPP)
  sendPaginated(res, result.data.map((q) => stripOpp(q, canViewOpp)), result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = requireUser(req)
  const { id } = req.params as { id: string }
  const quotation = await quotationsService.getQuotationById(id, user)
  sendSuccess(res, stripOpp(quotation, user.permissions.includes(Permission.QUOTATION_VIEW_OPP)))
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = requireUser(req)
  const { id } = req.params as { id: string }
  const input = req.body as UpdateQuotationDTO
  const quotation = await quotationsService.updateQuotation(id, input, user)
  sendSuccess(res, stripOpp(quotation, user.permissions.includes(Permission.QUOTATION_VIEW_OPP)))
}

export async function changeState(req: Request, res: Response): Promise<void> {
  const user = requireUser(req)
  const { id } = req.params as { id: string }
  const input = req.body as ChangeStateDTO
  const quotation = await quotationsService.changeQuotationState(id, input, user, getMeta(req))
  sendSuccess(res, stripOpp(quotation, user.permissions.includes(Permission.QUOTATION_VIEW_OPP)))
}

export async function compare(req: Request, res: Response): Promise<void> {
  const { opportunity_id } = req.query as unknown as CompareQuery
  const quotations = await quotationsService.compareByOpportunity(opportunity_id)
  sendSuccess(res, quotations)
}

export async function overrideCostDetail(req: Request, res: Response): Promise<void> {
  const user = requireUser(req)
  const { id, costDetailId } = req.params as { id: string; costDetailId: string }
  const input = req.body as OverrideCostDetailDTO
  const quotation = await quotationsService.overrideCostDetail(id, costDetailId, input, user)
  sendSuccess(res, stripOpp(quotation, user.permissions.includes(Permission.QUOTATION_VIEW_OPP)))
}

export async function revertCostDetailOverride(req: Request, res: Response): Promise<void> {
  const user = requireUser(req)
  const { id, costDetailId } = req.params as { id: string; costDetailId: string }
  const { reason } = req.body as RevertCostDetailDTO
  const quotation = await quotationsService.revertCostDetailOverride(id, costDetailId, user, reason)
  sendSuccess(res, stripOpp(quotation, user.permissions.includes(Permission.QUOTATION_VIEW_OPP)))
}
