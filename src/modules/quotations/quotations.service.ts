import { Permission, Prisma, type Quotation, QuotationStatus, Role } from '@prisma/client'
import { prisma } from '../../config/database'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../shared/utils/paginate'
import { pickDefined } from '../../shared/utils/pick-defined'
import { generateReferenceNumber } from '../../shared/utils/reference-generator'
import type { PaginatedResult } from '../../shared/types/pagination'
import { calculateQuotation, recomputeTotalsFromCostDetails } from '../calculation-engine/engine.service'
import { toUsd } from '../calculation-engine/currency.converter'
import type { CostDetailLine, TariffComponentLike } from '../calculation-engine/types'
import { getActiveTariff as getActiveConsolidatorTariff } from '../tariffs/consolidator-tariffs/consolidator-tariffs.service'
import { getActiveTariff as getActiveCustomsAgentTariff } from '../tariffs/customs-agent-tariffs/customs-agent-tariffs.service'
import { getLatestExchangeRate } from '../master-data/exchange-rates/exchange-rates.service'
import { assertValidTransition, timestampFieldFor } from './quotations.state-machine'
import type {
  ChangeStateDTO,
  CreateQuotationDTO,
  ListQuotationsQuery,
  OverrideCostDetailDTO,
  QuotationProductInputDTO,
  UpdateQuotationDTO,
} from './quotations.schema'

interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
}

interface ActingUser {
  id: string
  role: Role
}

// COMERCIAL solo ve/edita sus propias cotizaciones (responsible_user_id).
// ADMIN y OPERACIONES ven todas (Operaciones consulta/borradores, no son "de nadie").
function assertCanAccessQuotation(quotation: { responsible_user_id: string }, actingUser: ActingUser): void {
  if (actingUser.role === Role.COMERCIAL && quotation.responsible_user_id !== actingUser.id) {
    throw new ForbiddenError('No tienes acceso a esta cotización')
  }
}

const QUOTATION_INCLUDE = {
  products: true,
  cost_details: { orderBy: { sort_order: 'asc' as const } },
  audit_state_changes: { orderBy: { changed_at: 'asc' as const } },
}

type QuotationDetail = Prisma.QuotationGetPayload<{ include: typeof QUOTATION_INCLUDE }>

async function currencyCodeMap(): Promise<Map<string, string>> {
  const currencies = await prisma.currency.findMany()
  return new Map(currencies.map((c) => [c.id, c.code]))
}

async function resolveProducts(
  lines: QuotationProductInputDTO[],
): Promise<{ productLine: QuotationProductInputDTO; weightKg: number; weightLb: number; volumeCft: number }[]> {
  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.product_id) } },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  return lines.map((line) => {
    const product = productMap.get(line.product_id)
    if (!product || product.deleted_at) {
      throw new NotFoundError(`Producto ${line.product_id}`)
    }
    const weightKg = (line.weight_kg_override ?? Number(product.weight_kg)) * line.quantity
    const weightLb = (line.weight_lb_override ?? Number(product.weight_lb)) * line.quantity
    const volumeCft = (line.volume_cft_override ?? Number(product.volume_cft)) * line.quantity
    return { productLine: line, weightKg, weightLb, volumeCft }
  })
}

function toCostDetailInput(
  lines: CostDetailLine[],
): Prisma.QuotationCostDetailCreateManyQuotationInput[] {
  return lines.map((line) => ({
    ...line,
    calculation_snapshot: line.calculation_snapshot as Prisma.InputJsonValue,
  }))
}

function toComponentLike(
  component: { currency_id: string } & Record<string, unknown>,
  codeMap: Map<string, string>,
): TariffComponentLike {
  const code = codeMap.get(component.currency_id)
  if (!code) throw new ValidationError('Moneda de componente de tarifa no encontrada')
  return { ...component, currencyCode: code } as unknown as TariffComponentLike
}

// Filtra los componentes del agente marcados is_optional que el usuario decidió
// excluir para esta cotización puntual. Excluir un componente no opcional es un error.
function applyExcludedComponents<T extends { id: string; is_optional: boolean }>(
  components: T[],
  excludedIds: string[] | undefined,
): T[] {
  if (!excludedIds || excludedIds.length === 0) return components

  const byId = new Map(components.map((c) => [c.id, c]))
  for (const excludedId of excludedIds) {
    const component = byId.get(excludedId)
    if (!component) {
      throw new ValidationError(`El componente ${excludedId} no pertenece a la tarifa del agente activa`)
    }
    if (!component.is_optional) {
      throw new ValidationError(`El componente "${component.id}" no es opcional y no puede excluirse`)
    }
  }

  const excludedSet = new Set(excludedIds)
  return components.filter((c) => !excludedSet.has(c.id))
}

// Deriva qué componentes opcionales estaban excluidos previamente (no se persiste
// una lista aparte: la ausencia de su cost_detail en la cotización ES el registro).
async function getPreviouslyExcludedOptionalIds(
  quotationId: string,
  optionalComponentIds: string[],
): Promise<string[]> {
  if (optionalComponentIds.length === 0) return []

  const present = await prisma.quotationCostDetail.findMany({
    where: {
      quotation_id: quotationId,
      customs_agent_tariff_component_id: { in: optionalComponentIds },
    },
    select: { customs_agent_tariff_component_id: true },
  })
  const presentIds = new Set(present.map((p) => p.customs_agent_tariff_component_id))
  return optionalComponentIds.filter((id) => !presentIds.has(id))
}

export async function createQuotation(
  input: CreateQuotationDTO,
  responsibleUserId: string,
): Promise<QuotationDetail> {
  const [consolidatorTariff, customsAgentTariff, exchangeRate, resolvedProducts, codeMap] = await Promise.all([
    getActiveConsolidatorTariff({
      consolidator_id: input.consolidator_id,
      country_id: input.country_id,
      transport_type: input.transport_type,
    }),
    getActiveCustomsAgentTariff({
      customs_agent_id: input.customs_agent_id,
      country_id: input.country_id,
    }),
    getLatestExchangeRate({ from: 'USD', to: 'HNL' }),
    resolveProducts(input.products),
    currencyCodeMap(),
  ])

  const productInputs = resolvedProducts.map(({ productLine, weightKg, weightLb, volumeCft }) => ({
    product_id: productLine.product_id,
    quantity: productLine.quantity,
    weight_kg_used: weightKg,
    weight_lb_used: weightLb,
    volume_cft_used: volumeCft,
    fob_unit_price: productLine.fob_unit_price,
    fob_total: productLine.fob_unit_price * productLine.quantity,
  }))

  const includedCustomsAgentComponents = applyExcludedComponents(
    customsAgentTariff.components,
    input.excluded_component_ids,
  )

  const result = calculateQuotation({
    products: productInputs,
    otherInternationalCosts: input.other_international_costs,
    marginAmount: input.margin_amount,
    exchangeRateUsdToHnl: Number(exchangeRate.rate),
    consolidatorComponents: consolidatorTariff.components.map((c) => toComponentLike(c, codeMap)),
    customsAgentComponents: includedCustomsAgentComponents.map((c) => toComponentLike(c, codeMap)),
  })

  return prisma.$transaction(async (tx) => {
    const reference_number = await generateReferenceNumber(tx)

    return tx.quotation.create({
      data: {
        reference_number,
        status: QuotationStatus.BORRADOR,
        transport_type: input.transport_type,
        client_id: input.client_id,
        country_id: input.country_id,
        consolidator_id: input.consolidator_id,
        customs_agent_id: input.customs_agent_id,
        consolidator_tariff_id: consolidatorTariff.id,
        customs_agent_tariff_id: customsAgentTariff.id,
        exchange_rate: exchangeRate.rate,
        exchange_rate_date: exchangeRate.date,
        total_weight_kg: result.total_weight_kg,
        total_weight_lb: result.total_weight_lb,
        total_volume_cft: result.total_volume_cft,
        fob: result.fob,
        insurance: result.insurance,
        other_international_costs: result.other_international_costs,
        subtotal_consolidator: result.subtotal_consolidator,
        cif: result.cif,
        subtotal_customs_agent: result.subtotal_customs_agent,
        total_cost: result.total_cost,
        margin_amount: result.margin_amount,
        margin_percentage: result.margin_percentage,
        sale_price: result.sale_price,
        nationalization_base: result.nationalization_base,
        nationalization_percentage: result.nationalization_percentage,
        responsible_user_id: responsibleUserId,
        ...pickDefined({
          observations: input.observations,
          internal_notes: input.internal_notes,
          pallet_id: input.pallet_id,
          opportunity_id: input.opportunity_id,
        }),
        products: { createMany: { data: productInputs } },
        cost_details: { createMany: { data: toCostDetailInput(result.cost_details) } },
      },
      include: QUOTATION_INCLUDE,
    })
  })
}

export async function listQuotations(
  query: ListQuotationsQuery,
  actingUser: ActingUser,
): Promise<PaginatedResult<Quotation>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.client_id ? { client_id: query.client_id } : {}),
    ...(query.country_id ? { country_id: query.country_id } : {}),
    // COMERCIAL solo ve las suyas — se fuerza sin importar lo que pida el query.
    ...(actingUser.role === Role.COMERCIAL ? { responsible_user_id: actingUser.id } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.quotation.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    prisma.quotation.count({ where }),
  ])

  return { data, meta: buildPaginationMeta(total, page, limit) }
}

export async function getQuotationById(id: string, actingUser: ActingUser): Promise<QuotationDetail> {
  const quotation = await prisma.quotation.findUnique({ where: { id }, include: QUOTATION_INCLUDE })
  if (!quotation) throw new NotFoundError('Cotización')
  assertCanAccessQuotation(quotation, actingUser)
  return quotation
}

async function findQuotationOrThrow(id: string): Promise<Quotation> {
  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) throw new NotFoundError('Cotización')
  return quotation
}

// Un edit normal solo requiere QUOTATION_EDIT mientras esté en BORRADOR; una vez
// que avanzó de estado, requiere QUOTATION_EDIT_AFTER_SENT + una razón obligatoria.
function assertCanEditPastDraft(
  quotation: { status: QuotationStatus },
  actingUser: { permissions: Permission[] },
  reason: string | undefined,
): boolean {
  const isPastDraft = quotation.status !== QuotationStatus.BORRADOR
  if (isPastDraft) {
    if (!actingUser.permissions.includes(Permission.QUOTATION_EDIT_AFTER_SENT)) {
      throw new ForbiddenError('Esta cotización ya no está en borrador; se requiere permiso especial para editarla')
    }
    if (!reason?.trim()) {
      throw new ValidationError('Se requiere una razón para editar una cotización que ya no está en borrador')
    }
  }
  return isPastDraft
}

export async function updateQuotation(
  id: string,
  input: UpdateQuotationDTO,
  actingUser: ActingUser & { permissions: Permission[] },
): Promise<QuotationDetail> {
  const quotation = await findQuotationOrThrow(id)
  assertCanAccessQuotation(quotation, actingUser)
  const isPastDraft = assertCanEditPastDraft(quotation, actingUser, input.reason)

  const affectsCalculation =
    input.products !== undefined ||
    input.other_international_costs !== undefined ||
    input.margin_amount !== undefined ||
    input.excluded_component_ids !== undefined

  const auditEntries: { field_name: string; old_value: string; new_value: string }[] = []
  const trackChange = (field: string, oldValue: unknown, newValue: unknown): void => {
    if (isPastDraft && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      auditEntries.push({ field_name: field, old_value: JSON.stringify(oldValue), new_value: JSON.stringify(newValue) })
    }
  }

  let data: Prisma.QuotationUpdateInput = pickDefined({
    observations: input.observations,
    internal_notes: input.internal_notes,
  })

  if (input.observations !== undefined) trackChange('observations', quotation.observations, input.observations)
  if (input.internal_notes !== undefined) trackChange('internal_notes', quotation.internal_notes, input.internal_notes)

  let newProductsData: Prisma.QuotationProductCreateManyQuotationInput[] | undefined

  if (affectsCalculation) {
    const codeMap = await currencyCodeMap()
    const [consolidatorTariff, customsAgentTariff] = await Promise.all([
      prisma.consolidatorTariff.findUniqueOrThrow({
        where: { id: quotation.consolidator_tariff_id },
        include: { components: true },
      }),
      prisma.customsAgentTariff.findUniqueOrThrow({
        where: { id: quotation.customs_agent_tariff_id },
        include: { components: true },
      }),
    ])

    const existingProducts = await prisma.quotationProduct.findMany({ where: { quotation_id: id } })
    const productLines: QuotationProductInputDTO[] =
      input.products ??
      existingProducts.map((p) => ({
        product_id: p.product_id,
        quantity: p.quantity,
        fob_unit_price: Number(p.fob_unit_price),
      }))

    const resolvedProducts = await resolveProducts(productLines)
    const productInputs = resolvedProducts.map(({ productLine, weightKg, weightLb, volumeCft }) => ({
      product_id: productLine.product_id,
      quantity: productLine.quantity,
      weight_kg_used: weightKg,
      weight_lb_used: weightLb,
      volume_cft_used: volumeCft,
      fob_unit_price: productLine.fob_unit_price,
      fob_total: productLine.fob_unit_price * productLine.quantity,
    }))

    const otherInternationalCosts = input.other_international_costs ?? Number(quotation.other_international_costs)
    const marginAmount = input.margin_amount ?? Number(quotation.margin_amount)

    const optionalIds = customsAgentTariff.components.filter((c) => c.is_optional).map((c) => c.id)
    const previouslyExcludedIds = await getPreviouslyExcludedOptionalIds(id, optionalIds)
    const excludedIds = input.excluded_component_ids ?? previouslyExcludedIds
    if (input.excluded_component_ids !== undefined) {
      trackChange('excluded_component_ids', previouslyExcludedIds.sort(), [...excludedIds].sort())
    }
    const includedCustomsAgentComponents = applyExcludedComponents(customsAgentTariff.components, excludedIds)

    const result = calculateQuotation({
      products: productInputs,
      otherInternationalCosts,
      marginAmount,
      exchangeRateUsdToHnl: Number(quotation.exchange_rate),
      consolidatorComponents: consolidatorTariff.components.map((c) => toComponentLike(c, codeMap)),
      customsAgentComponents: includedCustomsAgentComponents.map((c) => toComponentLike(c, codeMap)),
    })

    trackChange('other_international_costs', Number(quotation.other_international_costs), otherInternationalCosts)
    trackChange('margin_amount', Number(quotation.margin_amount), marginAmount)
    trackChange('total_cost', Number(quotation.total_cost), result.total_cost)

    newProductsData = productInputs
    data = {
      ...data,
      total_weight_kg: result.total_weight_kg,
      total_weight_lb: result.total_weight_lb,
      total_volume_cft: result.total_volume_cft,
      fob: result.fob,
      insurance: result.insurance,
      other_international_costs: result.other_international_costs,
      subtotal_consolidator: result.subtotal_consolidator,
      cif: result.cif,
      subtotal_customs_agent: result.subtotal_customs_agent,
      total_cost: result.total_cost,
      margin_amount: result.margin_amount,
      margin_percentage: result.margin_percentage,
      sale_price: result.sale_price,
      nationalization_base: result.nationalization_base,
      nationalization_percentage: result.nationalization_percentage,
      cost_details: {
        deleteMany: {},
        createMany: { data: toCostDetailInput(result.cost_details) },
      },
    }
    if (newProductsData) {
      data.products = { deleteMany: {}, createMany: { data: newProductsData } }
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.quotation.update({ where: { id }, data, include: QUOTATION_INCLUDE })

    if (auditEntries.length > 0) {
      await tx.auditDataChange.createMany({
        data: auditEntries.map((entry) => ({
          quotation_id: id,
          field_name: entry.field_name,
          old_value: entry.old_value,
          new_value: entry.new_value,
          changed_by: actingUser.id,
          reason: input.reason ?? null,
        })),
      })
    }

    return updated
  })
}

export async function changeQuotationState(
  id: string,
  input: ChangeStateDTO,
  actingUser: ActingUser,
  meta: RequestMeta,
): Promise<QuotationDetail> {
  const quotation = await findQuotationOrThrow(id)
  assertCanAccessQuotation(quotation, actingUser)
  assertValidTransition(quotation.status, input.to_status, input.reason)

  const timestampField = timestampFieldFor(input.to_status)

  return prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id },
      data: {
        status: input.to_status,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    })

    await tx.auditStateChange.create({
      data: {
        quotation_id: id,
        from_status: quotation.status,
        to_status: input.to_status,
        changed_by: actingUser.id,
        ...pickDefined({ reason: input.reason }),
        ...pickDefined({ ip_address: meta.ipAddress ?? undefined, user_agent: meta.userAgent ?? undefined }),
      },
    })

    return tx.quotation.findUniqueOrThrow({ where: { id }, include: QUOTATION_INCLUDE })
  })
}

export async function compareByOpportunity(opportunityId: number): Promise<Quotation[]> {
  return prisma.quotation.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { created_at: 'asc' },
  })
}

async function findCostDetailOrThrow(
  quotationId: string,
  costDetailId: string,
): Promise<Prisma.QuotationCostDetailGetPayload<Record<string, never>>> {
  const costDetail = await prisma.quotationCostDetail.findUnique({ where: { id: costDetailId } })
  if (!costDetail || costDetail.quotation_id !== quotationId) {
    throw new NotFoundError('Línea de costo')
  }
  return costDetail
}

async function reapplyTotalsFromCostDetails(
  tx: Prisma.TransactionClient,
  quotationId: string,
  fob: number,
  marginAmount: number,
): Promise<QuotationDetail> {
  const allCostDetails = await tx.quotationCostDetail.findMany({ where: { quotation_id: quotationId } })
  const totals = recomputeTotalsFromCostDetails(
    fob,
    marginAmount,
    allCostDetails.map((c) => ({ category: c.category, amount_usd: Number(c.amount_usd), is_tax: c.is_tax })),
  )

  return tx.quotation.update({
    where: { id: quotationId },
    data: {
      insurance: totals.insurance,
      other_international_costs: totals.other_international_costs,
      subtotal_consolidator: totals.subtotal_consolidator,
      cif: totals.cif,
      subtotal_customs_agent: totals.subtotal_customs_agent,
      total_cost: totals.total_cost,
      margin_percentage: totals.margin_percentage,
      sale_price: totals.sale_price,
      nationalization_base: totals.nationalization_base,
      nationalization_percentage: totals.nationalization_percentage,
    },
    include: QUOTATION_INCLUDE,
  })
}

// Deja fijo el amount_usd de una línea de costo puntual (con justificación
// obligatoria) y recalcula los totales de la cotización a partir de las líneas
// ya guardadas — no vuelve a consultar tarifas ni a recalcular los demás componentes.
export async function overrideCostDetail(
  quotationId: string,
  costDetailId: string,
  input: OverrideCostDetailDTO,
  actingUser: ActingUser & { permissions: Permission[] },
): Promise<QuotationDetail> {
  const quotation = await findQuotationOrThrow(quotationId)
  assertCanAccessQuotation(quotation, actingUser)
  const isPastDraft = assertCanEditPastDraft(quotation, actingUser, input.reason)
  const costDetail = await findCostDetailOrThrow(quotationId, costDetailId)

  return prisma.$transaction(async (tx) => {
    await tx.quotationCostDetail.update({
      where: { id: costDetailId },
      data: { amount_usd: input.amount_usd, is_manual_override: true, override_reason: input.reason },
    })

    const updated = await reapplyTotalsFromCostDetails(
      tx,
      quotationId,
      Number(quotation.fob),
      Number(quotation.margin_amount),
    )

    if (isPastDraft) {
      await tx.auditDataChange.create({
        data: {
          quotation_id: quotationId,
          field_name: `cost_detail:${costDetail.component_name}`,
          old_value: JSON.stringify(Number(costDetail.amount_usd)),
          new_value: JSON.stringify(input.amount_usd),
          changed_by: actingUser.id,
          reason: input.reason,
        },
      })
    }

    return updated
  })
}

// Revierte una línea previamente sobreescrita a su valor calculado original
// (reconvertido desde original_amount/original_currency, tal cual quedó registrado
// en el snapshot al crear/recalcular la cotización).
export async function revertCostDetailOverride(
  quotationId: string,
  costDetailId: string,
  actingUser: ActingUser & { permissions: Permission[] },
  reason: string | undefined,
): Promise<QuotationDetail> {
  const quotation = await findQuotationOrThrow(quotationId)
  assertCanAccessQuotation(quotation, actingUser)
  const isPastDraft = assertCanEditPastDraft(quotation, actingUser, reason)
  const costDetail = await findCostDetailOrThrow(quotationId, costDetailId)

  if (!costDetail.is_manual_override) {
    throw new ValidationError('Esta línea no tiene un valor sobreescrito para revertir')
  }

  const exchangeRate = costDetail.exchange_rate ? Number(costDetail.exchange_rate) : Number(quotation.exchange_rate)
  const naturalAmountUsd = toUsd(Number(costDetail.original_amount), costDetail.original_currency, exchangeRate)

  return prisma.$transaction(async (tx) => {
    await tx.quotationCostDetail.update({
      where: { id: costDetailId },
      data: { amount_usd: naturalAmountUsd, is_manual_override: false, override_reason: null },
    })

    const updated = await reapplyTotalsFromCostDetails(
      tx,
      quotationId,
      Number(quotation.fob),
      Number(quotation.margin_amount),
    )

    if (isPastDraft) {
      await tx.auditDataChange.create({
        data: {
          quotation_id: quotationId,
          field_name: `cost_detail:${costDetail.component_name}`,
          old_value: JSON.stringify(Number(costDetail.amount_usd)),
          new_value: JSON.stringify(naturalAmountUsd),
          changed_by: actingUser.id,
          reason: reason ?? 'Reversión de sobreescritura manual',
        },
      })
    }

    return updated
  })
}
