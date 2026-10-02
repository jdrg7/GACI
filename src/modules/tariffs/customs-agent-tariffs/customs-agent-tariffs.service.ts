import {
  CostCategory,
  Prisma,
  type CustomsAgentTariff,
  type CustomsAgentTariffComponent,
} from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type {
  ActiveCustomsAgentTariffQuery,
  CreateCustomsAgentTariffDTO,
  CustomsAgentTariffComponentDTO,
  ListCustomsAgentTariffsQuery,
  UpdateCustomsAgentTariffDTO,
} from './customs-agent-tariffs.schema'

type TariffWithComponents = CustomsAgentTariff & { components: CustomsAgentTariffComponent[] }

async function findTariffOrThrow(id: string): Promise<CustomsAgentTariff> {
  const tariff = await prisma.customsAgentTariff.findUnique({ where: { id } })
  if (!tariff) throw new NotFoundError('Tarifa de agente aduanero')
  return tariff
}

export async function listTariffs(
  query: ListCustomsAgentTariffsQuery,
): Promise<PaginatedResult<CustomsAgentTariff>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    ...(query.customs_agent_id ? { customs_agent_id: query.customs_agent_id } : {}),
    ...(query.country_id ? { country_id: query.country_id } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.customsAgentTariff.findMany({ where, skip, take, orderBy: { valid_from: 'desc' } }),
    prisma.customsAgentTariff.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getTariffById(id: string): Promise<TariffWithComponents> {
  const tariff = await prisma.customsAgentTariff.findUnique({
    where: { id },
    include: { components: { orderBy: { sort_order: 'asc' } } },
  })
  if (!tariff) throw new NotFoundError('Tarifa de agente aduanero')
  return tariff
}

export async function getActiveTariff(
  query: ActiveCustomsAgentTariffQuery,
): Promise<TariffWithComponents> {
  const today = new Date()
  const tariff = await prisma.customsAgentTariff.findFirst({
    where: {
      customs_agent_id: query.customs_agent_id,
      country_id: query.country_id,
      is_active: true,
      valid_from: { lte: today },
      OR: [{ valid_until: null }, { valid_until: { gte: today } }],
    },
    orderBy: { valid_from: 'desc' },
    include: { components: { orderBy: { sort_order: 'asc' } } },
  })

  if (!tariff) throw new NotFoundError('Tarifa de agente aduanero vigente')
  return tariff
}

export async function createTariff(
  input: CreateCustomsAgentTariffDTO,
  createdBy: string,
): Promise<CustomsAgentTariff> {
  return prisma.customsAgentTariff.create({
    data: {
      customs_agent_id: input.customs_agent_id,
      country_id: input.country_id,
      name: input.name,
      valid_from: input.valid_from,
      created_by: createdBy,
      ...pickDefined({ valid_until: input.valid_until, notes: input.notes }),
    },
  })
}

export async function updateTariff(
  id: string,
  input: UpdateCustomsAgentTariffDTO,
): Promise<CustomsAgentTariff> {
  await findTariffOrThrow(id)
  return prisma.customsAgentTariff.update({ where: { id }, data: pickDefined(input) })
}

export async function addComponent(
  tariffId: string,
  input: CustomsAgentTariffComponentDTO,
): Promise<CustomsAgentTariffComponent> {
  await findTariffOrThrow(tariffId)

  let sortOrder = input.sort_order
  if (sortOrder === undefined) {
    const last = await prisma.customsAgentTariffComponent.findFirst({
      where: { customs_agent_tariff_id: tariffId },
      orderBy: { sort_order: 'desc' },
    })
    sortOrder = (last?.sort_order ?? -1) + 1
  }

  return prisma.customsAgentTariffComponent.create({
    data: {
      customs_agent_tariff_id: tariffId,
      name: input.name,
      category: CostCategory.CUSTOMS_AGENT,
      calculation_type: input.calculation_type,
      currency_id: input.currency_id,
      sort_order: sortOrder,
      ...pickDefined({
        fixed_amount: input.fixed_amount,
        rate_per_unit: input.rate_per_unit,
        rate_percentage: input.rate_percentage,
        minimum_amount: input.minimum_amount,
        maximum_amount: input.maximum_amount,
        tariff_ranges: input.tariff_ranges,
        basis_unit: input.basis_unit,
        notes: input.notes,
        is_optional: input.is_optional,
        is_tax: input.is_tax,
      }),
    },
  })
}

async function findComponentOrThrow(
  tariffId: string,
  componentId: string,
): Promise<CustomsAgentTariffComponent> {
  const component = await prisma.customsAgentTariffComponent.findUnique({
    where: { id: componentId },
  })
  if (!component || component.customs_agent_tariff_id !== tariffId) {
    throw new NotFoundError('Componente de tarifa')
  }
  return component
}

export async function updateComponent(
  tariffId: string,
  componentId: string,
  input: CustomsAgentTariffComponentDTO,
): Promise<CustomsAgentTariffComponent> {
  await findComponentOrThrow(tariffId, componentId)

  return prisma.customsAgentTariffComponent.update({
    where: { id: componentId },
    data: {
      name: input.name,
      calculation_type: input.calculation_type,
      currency_id: input.currency_id,
      fixed_amount: input.fixed_amount ?? null,
      rate_per_unit: input.rate_per_unit ?? null,
      rate_percentage: input.rate_percentage ?? null,
      minimum_amount: input.minimum_amount ?? null,
      maximum_amount: input.maximum_amount ?? null,
      tariff_ranges: input.tariff_ranges ?? Prisma.JsonNull,
      basis_unit: input.basis_unit ?? null,
      is_optional: input.is_optional ?? false,
      is_tax: input.is_tax ?? false,
      ...pickDefined({ sort_order: input.sort_order, notes: input.notes }),
    },
  })
}

export async function deleteComponent(tariffId: string, componentId: string): Promise<void> {
  await findComponentOrThrow(tariffId, componentId)
  await prisma.customsAgentTariffComponent.delete({ where: { id: componentId } })
}
