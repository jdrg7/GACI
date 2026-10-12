import { Prisma, type ConsolidatorTariff, type ConsolidatorTariffComponent } from '@prisma/client'
import { prisma } from '../../../config/database'
import { NotFoundError } from '../../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../../shared/utils/paginate'
import { pickDefined } from '../../../shared/utils/pick-defined'
import type { PaginatedResult } from '../../../shared/types/pagination'
import type {
  ActiveConsolidatorTariffQuery,
  ConsolidatorTariffComponentDTO,
  CreateConsolidatorTariffDTO,
  ListConsolidatorTariffsQuery,
  UpdateConsolidatorTariffDTO,
} from './consolidator-tariffs.schema'

type TariffWithComponents = ConsolidatorTariff & { components: ConsolidatorTariffComponent[] }

async function findTariffOrThrow(id: string): Promise<ConsolidatorTariff> {
  const tariff = await prisma.consolidatorTariff.findUnique({ where: { id } })
  if (!tariff) throw new NotFoundError('Tarifa de consolidador')
  return tariff
}

export async function listTariffs(
  query: ListConsolidatorTariffsQuery,
): Promise<PaginatedResult<ConsolidatorTariff>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    ...(query.consolidator_id ? { consolidator_id: query.consolidator_id } : {}),
    ...(query.country_id ? { country_id: query.country_id } : {}),
    ...(query.transport_type ? { transport_type: query.transport_type } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.consolidatorTariff.findMany({ where, skip, take, orderBy: { valid_from: 'desc' } }),
    prisma.consolidatorTariff.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getTariffById(id: string): Promise<TariffWithComponents> {
  const tariff = await prisma.consolidatorTariff.findUnique({
    where: { id },
    include: { components: { orderBy: { sort_order: 'asc' } } },
  })
  if (!tariff) throw new NotFoundError('Tarifa de consolidador')
  return tariff
}

export async function getActiveTariff(
  query: ActiveConsolidatorTariffQuery,
): Promise<TariffWithComponents> {
  const today = new Date()
  const tariff = await prisma.consolidatorTariff.findFirst({
    where: {
      consolidator_id: query.consolidator_id,
      country_id: query.country_id,
      transport_type: query.transport_type,
      is_active: true,
      valid_from: { lte: today },
      OR: [{ valid_until: null }, { valid_until: { gte: today } }],
    },
    orderBy: { valid_from: 'desc' },
    include: { components: { orderBy: { sort_order: 'asc' } } },
  })

  if (!tariff) throw new NotFoundError('Tarifa de consolidador vigente')
  return tariff
}

export async function createTariff(
  input: CreateConsolidatorTariffDTO,
  createdBy: string,
): Promise<ConsolidatorTariff> {
  return prisma.consolidatorTariff.create({
    data: {
      consolidator_id: input.consolidator_id,
      country_id: input.country_id,
      transport_type: input.transport_type,
      name: input.name,
      valid_from: input.valid_from,
      created_by: createdBy,
      ...pickDefined({ valid_until: input.valid_until, notes: input.notes }),
    },
  })
}

export async function updateTariff(
  id: string,
  input: UpdateConsolidatorTariffDTO,
): Promise<ConsolidatorTariff> {
  await findTariffOrThrow(id)
  return prisma.consolidatorTariff.update({ where: { id }, data: pickDefined(input) })
}

export async function addComponent(
  tariffId: string,
  input: ConsolidatorTariffComponentDTO,
): Promise<ConsolidatorTariffComponent> {
  await findTariffOrThrow(tariffId)

  let sortOrder = input.sort_order
  if (sortOrder === undefined) {
    const last = await prisma.consolidatorTariffComponent.findFirst({
      where: { consolidator_tariff_id: tariffId },
      orderBy: { sort_order: 'desc' },
    })
    sortOrder = (last?.sort_order ?? -1) + 1
  }

  return prisma.consolidatorTariffComponent.create({
    data: {
      consolidator_tariff_id: tariffId,
      name: input.name,
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
      }),
    },
  })
}

async function findComponentOrThrow(
  tariffId: string,
  componentId: string,
): Promise<ConsolidatorTariffComponent> {
  const component = await prisma.consolidatorTariffComponent.findUnique({
    where: { id: componentId },
  })
  if (!component || component.consolidator_tariff_id !== tariffId) {
    throw new NotFoundError('Componente de tarifa')
  }
  return component
}

export async function updateComponent(
  tariffId: string,
  componentId: string,
  input: ConsolidatorTariffComponentDTO,
): Promise<ConsolidatorTariffComponent> {
  await findComponentOrThrow(tariffId, componentId)

  return prisma.consolidatorTariffComponent.update({
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
      ...pickDefined({ sort_order: input.sort_order, notes: input.notes }),
    },
  })
}

export async function deleteComponent(tariffId: string, componentId: string): Promise<void> {
  await findComponentOrThrow(tariffId, componentId)
  await prisma.consolidatorTariffComponent.delete({ where: { id: componentId } })
}
