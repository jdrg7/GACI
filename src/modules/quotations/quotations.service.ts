import {
  CostCategory,
  Permission,
  Prisma,
  type Quotation,
  QuotationStatus,
  Role,
  type ServiceLevel,
  TransportType,
} from '@prisma/client'
import { prisma } from '../../config/database'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../shared/utils/paginate'
import { pickDefined } from '../../shared/utils/pick-defined'
import { generateReferenceNumber } from '../../shared/utils/reference-generator'
import { round } from '../../shared/utils/round'
import type { PaginatedResult } from '../../shared/types/pagination'
import { recomputeTotalsFromCostDetails } from '../calculation-engine/engine.service'
import { toUsd } from '../calculation-engine/currency.converter'
import type { QuotationProductInput, TariffComponentLike } from '../calculation-engine/types'
import { getActiveTariff as getActiveConsolidatorTariff } from '../tariffs/consolidator-tariffs/consolidator-tariffs.service'
import { getActiveTariff as getActiveCustomsAgentTariff } from '../tariffs/customs-agent-tariffs/customs-agent-tariffs.service'
import { getLatestExchangeRate } from '../master-data/exchange-rates/exchange-rates.service'
import { assertValidTransition, timestampFieldFor } from './quotations.state-machine'
import {
  calculateScenario,
  cheapestOf,
  costDetailRows,
  scenarioRowData,
  type ScenarioResult,
  type ScenarioTotals,
  type TariffWithComponents,
} from './quotations.scenarios'
import type {
  ChangeStateDTO,
  CreateQuotationDTO,
  ListQuotationsQuery,
  OverrideCostDetailDTO,
  QuotationProductInputDTO,
  SelectScenarioDTO,
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

// Mientras la cotización no se haya enviado, cualquier recálculo usa las tarifas y el
// tipo de cambio vigentes. Al pasar a ENVIADA todo queda congelado.
const PRE_SEND_STATUSES = new Set<QuotationStatus>([
  QuotationStatus.BORRADOR,
  QuotationStatus.PENDIENTE,
  QuotationStatus.ALTERNATIVA,
])

// Estados donde un escenario "se compromete" y puede indicarse el modo de transporte.
const MODE_COMMIT_STATUSES = new Set<QuotationStatus>([QuotationStatus.ENVIADA, QuotationStatus.GANADA])

const SCENARIO_SNAPSHOT_FIELD: Partial<Record<QuotationStatus, string>> = {
  [QuotationStatus.ENVIADA]: 'sent_scenario',
  [QuotationStatus.GANADA]: 'accepted_scenario',
}

const QUOTATION_INCLUDE = {
  products: true,
  scenarios: { orderBy: { transport_type: 'asc' as const } },
  cost_details: { orderBy: { sort_order: 'asc' as const } },
  audit_state_changes: { orderBy: { changed_at: 'asc' as const } },
}

type RawQuotationDetail = Prisma.QuotationGetPayload<{ include: typeof QUOTATION_INCLUDE }>
type CostDetailRow = RawQuotationDetail['cost_details'][number]
type ScenarioRow = RawQuotationDetail['scenarios'][number]

// `cost_details` de primer nivel son las líneas del escenario ELEGIDO (así los consumidores
// que solo conocen un modo siguen funcionando); cada escenario trae además las suyas.
export type QuotationDetail = Omit<RawQuotationDetail, 'scenarios'> & {
  scenarios: (ScenarioRow & { cost_details: CostDetailRow[] })[]
}

function shapeQuotation(raw: RawQuotationDetail): QuotationDetail {
  const scenarios = raw.scenarios.map((scenario) => ({
    ...scenario,
    cost_details: raw.cost_details.filter((line) => line.scenario_id === scenario.id),
  }))
  const selected = scenarios.find((scenario) => scenario.transport_type === raw.transport_type)
  return { ...raw, scenarios, cost_details: selected ? selected.cost_details : raw.cost_details }
}

type Db = Prisma.TransactionClient | typeof prisma

async function loadQuotationDetail(db: Db, id: string): Promise<QuotationDetail> {
  const raw = await db.quotation.findUniqueOrThrow({ where: { id }, include: QUOTATION_INCLUDE })
  return shapeQuotation(raw)
}

async function currencyCodeMap(): Promise<Map<string, string>> {
  const currencies = await prisma.currency.findMany()
  return new Map(currencies.map((c) => [c.id, c.code]))
}

interface ResolvedProduct {
  productLine: QuotationProductInputDTO
  weightKg: number
  weightLb: number
  volumeCft: number
}

async function resolveProducts(lines: QuotationProductInputDTO[]): Promise<ResolvedProduct[]> {
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

function engineProductInput(resolved: ResolvedProduct): QuotationProductInput {
  const { productLine, weightKg, weightLb, volumeCft } = resolved
  return {
    product_id: productLine.product_id,
    quantity: productLine.quantity,
    weight_kg_used: weightKg,
    weight_lb_used: weightLb,
    volume_cft_used: volumeCft,
    fob_unit_price: productLine.fob_unit_price,
    fob_total: productLine.fob_unit_price * productLine.quantity,
  }
}

function productRow(resolved: ResolvedProduct): Prisma.QuotationProductCreateManyQuotationInput {
  const { productLine } = resolved
  return {
    ...engineProductInput(resolved),
    ...pickDefined({
      weight_kg_override: productLine.weight_kg_override,
      weight_lb_override: productLine.weight_lb_override,
      volume_cft_override: productLine.volume_cft_override,
    }),
  }
}

function toComponentLike(
  component: { currency_id: string } & Record<string, unknown>,
  codeMap: Map<string, string>,
): TariffComponentLike {
  const code = codeMap.get(component.currency_id)
  if (!code) throw new ValidationError('Moneda de componente de tarifa no encontrada')
  return { ...component, currencyCode: code } as unknown as TariffComponentLike
}

// Valida los IDs de componentes opcionales a excluir y los devuelve por NOMBRE: así la
// exclusión sobrevive si al recalcular se usa una versión nueva de la tarifa del agente.
function resolveExcludedNames(
  components: { id: string; name: string; is_optional: boolean }[],
  excludedIds: string[],
): Set<string> {
  const byId = new Map(components.map((c) => [c.id, c]))
  const names = new Set<string>()
  for (const excludedId of excludedIds) {
    const component = byId.get(excludedId)
    if (!component) {
      throw new ValidationError(`El componente ${excludedId} no pertenece a la tarifa del agente activa`)
    }
    if (!component.is_optional) {
      throw new ValidationError(`El componente "${component.id}" no es opcional y no puede excluirse`)
    }
    names.add(component.name)
  }
  return names
}

function applyExcludedNames<T extends { name: string; is_optional: boolean }>(
  components: T[],
  excludedNames: Set<string>,
): T[] {
  if (excludedNames.size === 0) return components
  return components.filter((c) => !(c.is_optional && excludedNames.has(c.name)))
}

// Una tarifa activa por modo de transporte; los modos sin tarifa vigente simplemente no aparecen.
async function loadActiveConsolidatorTariffs(
  consolidatorId: string,
  countryId: string,
): Promise<Map<TransportType, TariffWithComponents>> {
  const entries = await Promise.all(
    Object.values(TransportType).map(async (mode) => {
      try {
        const tariff = await getActiveConsolidatorTariff({
          consolidator_id: consolidatorId,
          country_id: countryId,
          transport_type: mode,
        })
        return [mode, tariff] as const
      } catch (error) {
        if (error instanceof NotFoundError) return null
        throw error
      }
    }),
  )
  return new Map(entries.filter((entry) => entry !== null))
}

interface ScenarioTotalsSource {
  subtotal_consolidator: Prisma.Decimal | number
  cif: Prisma.Decimal | number
  subtotal_customs_agent: Prisma.Decimal | number
  total_cost: Prisma.Decimal | number
  margin_amount: Prisma.Decimal | number
  margin_percentage: Prisma.Decimal | number
  sale_price: Prisma.Decimal | number
  nationalization_base: Prisma.Decimal | number
  nationalization_percentage: Prisma.Decimal | number
}

function pickTotals(source: ScenarioTotalsSource): ScenarioTotals {
  return {
    subtotal_consolidator: Number(source.subtotal_consolidator),
    cif: Number(source.cif),
    subtotal_customs_agent: Number(source.subtotal_customs_agent),
    total_cost: Number(source.total_cost),
    margin_amount: Number(source.margin_amount),
    margin_percentage: Number(source.margin_percentage),
    sale_price: Number(source.sale_price),
    nationalization_base: Number(source.nationalization_base),
    nationalization_percentage: Number(source.nationalization_percentage),
  }
}

// Guarda (crea o actualiza) cada escenario con sus líneas de costo.
async function persistScenarios(
  tx: Prisma.TransactionClient,
  quotationId: string,
  scenarios: ScenarioResult[],
): Promise<void> {
  for (const scenario of scenarios) {
    const row = await tx.quotationScenario.upsert({
      where: {
        quotation_id_transport_type: { quotation_id: quotationId, transport_type: scenario.transport_type },
      },
      create: scenarioRowData(quotationId, scenario),
      update: {
        consolidator_tariff_id: scenario.consolidator_tariff_id,
        volumetric_weight_lb: scenario.result.volumetric_weight_lb,
        chargeable_weight_kg: scenario.result.chargeable_weight_kg,
        ...scenario.totals,
      },
    })
    await tx.quotationCostDetail.deleteMany({ where: { scenario_id: row.id } })
    await tx.quotationCostDetail.createMany({ data: costDetailRows(quotationId, row.id, scenario.lines) })
  }
}

// Refleja en la cotización los totales del escenario ELEGIDO: el que escogió el comercial o,
// si aún no eligió, el más barato. Es lo que leen listas, dashboard y comparador.
async function syncSelectedScenario(
  tx: Prisma.TransactionClient,
  quotationId: string,
  forceMode?: TransportType,
): Promise<void> {
  const quotation = await tx.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    select: { transport_type: true, scenario_chosen: true },
  })
  const scenarios = await tx.quotationScenario.findMany({ where: { quotation_id: quotationId } })
  if (scenarios.length === 0) return

  const wanted = forceMode ?? (quotation.scenario_chosen ? quotation.transport_type : undefined)
  const selected =
    scenarios.find((s) => s.transport_type === wanted) ??
    cheapestOf(
      scenarios,
      (s) => Number(s.total_cost),
      (s) => s.transport_type,
    )

  const lines = await tx.quotationCostDetail.findMany({
    where: { scenario_id: selected.id },
    select: { category: true, amount_usd: true },
  })
  const sumOf = (category: CostCategory): number =>
    round(
      lines.filter((l) => l.category === category).reduce((sum, l) => sum + Number(l.amount_usd), 0),
      4,
    )

  await tx.quotation.update({
    where: { id: quotationId },
    data: {
      transport_type: selected.transport_type,
      consolidator_tariff_id: selected.consolidator_tariff_id,
      insurance: sumOf(CostCategory.INSURANCE),
      other_international_costs: sumOf(CostCategory.OTHER_INTERNATIONAL),
      subtotal_consolidator: selected.subtotal_consolidator,
      cif: selected.cif,
      subtotal_customs_agent: selected.subtotal_customs_agent,
      total_cost: selected.total_cost,
      margin_amount: selected.margin_amount,
      margin_percentage: selected.margin_percentage,
      sale_price: selected.sale_price,
      nationalization_base: selected.nationalization_base,
      nationalization_percentage: selected.nationalization_percentage,
    },
  })
}

export async function createQuotation(
  input: CreateQuotationDTO,
  responsibleUserId: string,
): Promise<QuotationDetail> {
  const [tariffs, customsAgentTariff, exchangeRate, resolvedProducts, codeMap] = await Promise.all([
    loadActiveConsolidatorTariffs(input.consolidator_id, input.country_id),
    getActiveCustomsAgentTariff({
      customs_agent_id: input.customs_agent_id,
      country_id: input.country_id,
    }),
    getLatestExchangeRate({ from: 'USD', to: 'HNL' }),
    resolveProducts(input.products),
    currencyCodeMap(),
  ])

  if (tariffs.size === 0) throw new NotFoundError('Tarifa de consolidador vigente')
  if (input.transport_type && !tariffs.has(input.transport_type)) {
    throw new NotFoundError(`Tarifa de consolidador vigente (${input.transport_type})`)
  }

  const excludedNames = resolveExcludedNames(customsAgentTariff.components, input.excluded_component_ids ?? [])
  const customsAgentComponents = applyExcludedNames(customsAgentTariff.components, excludedNames).map((c) =>
    toComponentLike(c, codeMap),
  )

  // Todos los modos con tarifa vigente se calculan siempre; "otros gastos" queda fuera por ahora.
  const scenarios = [...tariffs.values()].map((tariff) =>
    calculateScenario(tariff, {
      products: resolvedProducts.map(engineProductInput),
      marginAmount: input.margin_amount,
      otherInternationalCosts: 0,
      exchangeRateUsdToHnl: Number(exchangeRate.rate),
      serviceLevel: input.service_level,
      customsAgentComponents,
      toComponentLike: (c) => toComponentLike(c, codeMap),
    }),
  )

  const selected =
    scenarios.find((s) => s.transport_type === input.transport_type) ??
    cheapestOf(
      scenarios,
      (s) => s.totals.total_cost,
      (s) => s.transport_type,
    )
  const { result } = selected

  return prisma.$transaction(async (tx) => {
    const reference_number = await generateReferenceNumber(tx)

    const quotation = await tx.quotation.create({
      data: {
        reference_number,
        status: QuotationStatus.BORRADOR,
        transport_type: selected.transport_type,
        service_level: input.service_level,
        scenario_chosen: input.transport_type !== undefined,
        client_id: input.client_id,
        country_id: input.country_id,
        consolidator_id: input.consolidator_id,
        customs_agent_id: input.customs_agent_id,
        consolidator_tariff_id: selected.consolidator_tariff_id,
        customs_agent_tariff_id: customsAgentTariff.id,
        exchange_rate: exchangeRate.rate,
        exchange_rate_date: exchangeRate.date,
        total_weight_kg: result.total_weight_kg,
        total_weight_lb: result.total_weight_lb,
        total_volume_cft: result.total_volume_cft,
        fob: result.fob,
        insurance: result.insurance,
        other_international_costs: result.other_international_costs,
        ...selected.totals,
        responsible_user_id: responsibleUserId,
        ...pickDefined({
          observations: input.observations,
          internal_notes: input.internal_notes,
          pallet_id: input.pallet_id,
          opportunity_id: input.opportunity_id,
        }),
        products: { createMany: { data: resolvedProducts.map(productRow) } },
      },
    })

    await persistScenarios(tx, quotation.id, scenarios)
    return loadQuotationDetail(tx, quotation.id)
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
  const raw = await prisma.quotation.findUnique({ where: { id }, include: QUOTATION_INCLUDE })
  if (!raw) throw new NotFoundError('Cotización')
  assertCanAccessQuotation(raw, actingUser)
  return shapeQuotation(raw)
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

interface RecalcOptions {
  /** true = tarifas y tipo de cambio vigentes; false = los congelados de la cotización. */
  refresh: boolean
  products?: QuotationProductInputDTO[]
  marginAmount?: number
  serviceLevel?: ServiceLevel
  excludedIds?: string[]
}

interface Recalculation {
  scenarios: ScenarioResult[]
  serviceLevel: ServiceLevel
  agentTariffId: string
  exchangeRate: number
  exchangeRateDate: Date
  // Solo cuando el usuario envió productos nuevos; si no, los productos no cambian.
  productRows: Prisma.QuotationProductCreateManyQuotationInput[] | null
  excludedIdsBefore: string[]
  excludedIdsAfter: string[]
}

// Recalcula todos los escenarios de una cotización. Arrastra las líneas sobreescritas a
// mano (mismo escenario, categoría y nombre) y respeta los componentes opcionales excluidos.
async function recalculateQuotation(quotation: Quotation, options: RecalcOptions): Promise<Recalculation> {
  const codeMap = await currencyCodeMap()

  const [existingScenarios, frozenAgentTariff, agentLines, overrides] = await Promise.all([
    prisma.quotationScenario.findMany({
      where: { quotation_id: quotation.id },
      include: { consolidator_tariff: { include: { components: true } } },
    }),
    prisma.customsAgentTariff.findUniqueOrThrow({
      where: { id: quotation.customs_agent_tariff_id },
      include: { components: true },
    }),
    prisma.quotationCostDetail.findMany({
      where: { quotation_id: quotation.id, category: CostCategory.CUSTOMS_AGENT },
      select: { component_name: true },
    }),
    prisma.quotationCostDetail.findMany({
      where: { quotation_id: quotation.id, is_manual_override: true },
      include: { scenario: { select: { transport_type: true } } },
    }),
  ])

  // Opcionales excluidos hoy = los opcionales de la tarifa congelada que no tienen línea.
  const presentAgentNames = new Set(agentLines.map((l) => l.component_name))
  const excludedBefore = frozenAgentTariff.components.filter((c) => c.is_optional && !presentAgentNames.has(c.name))
  const excludedNames = options.excludedIds
    ? resolveExcludedNames(frozenAgentTariff.components, options.excludedIds)
    : new Set(excludedBefore.map((c) => c.name))
  const excludedAfter = frozenAgentTariff.components.filter((c) => c.is_optional && excludedNames.has(c.name))

  // Tarifas a usar por modo: las congeladas, y si se refresca, las vigentes de cada modo
  // (un modo sin tarifa vigente conserva la suya congelada).
  const tariffsByMode = new Map<TransportType, TariffWithComponents>()
  for (const scenario of existingScenarios) tariffsByMode.set(scenario.transport_type, scenario.consolidator_tariff)

  let agentTariff = frozenAgentTariff
  let exchangeRate = Number(quotation.exchange_rate)
  let exchangeRateDate = quotation.exchange_rate_date

  if (options.refresh) {
    const active = await loadActiveConsolidatorTariffs(quotation.consolidator_id, quotation.country_id)
    for (const [mode, tariff] of active) tariffsByMode.set(mode, tariff)

    try {
      agentTariff = await getActiveCustomsAgentTariff({
        customs_agent_id: quotation.customs_agent_id,
        country_id: quotation.country_id,
      })
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error
    }

    try {
      const latest = await getLatestExchangeRate({ from: 'USD', to: 'HNL' })
      exchangeRate = Number(latest.rate)
      exchangeRateDate = latest.date
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error
    }
  }

  let productInputs: QuotationProductInput[]
  let productRows: Prisma.QuotationProductCreateManyQuotationInput[] | null = null
  if (options.products) {
    const resolved = await resolveProducts(options.products)
    productInputs = resolved.map(engineProductInput)
    productRows = resolved.map(productRow)
  } else {
    const stored = await prisma.quotationProduct.findMany({ where: { quotation_id: quotation.id } })
    productInputs = stored.map((p) => ({
      product_id: p.product_id,
      quantity: p.quantity,
      weight_kg_used: Number(p.weight_kg_used),
      weight_lb_used: Number(p.weight_lb_used),
      volume_cft_used: Number(p.volume_cft_used),
      fob_unit_price: Number(p.fob_unit_price),
      fob_total: Number(p.fob_total),
    }))
  }

  if (tariffsByMode.size === 0) throw new NotFoundError('Tarifa de consolidador vigente')

  const marginAmount = options.marginAmount ?? Number(quotation.margin_amount)
  const serviceLevel = options.serviceLevel ?? quotation.service_level
  const customsAgentComponents = applyExcludedNames(agentTariff.components, excludedNames).map((c) =>
    toComponentLike(c, codeMap),
  )

  const scenarios = [...tariffsByMode.values()].map((tariff) => {
    const scenario = calculateScenario(tariff, {
      products: productInputs,
      marginAmount,
      otherInternationalCosts: Number(quotation.other_international_costs),
      exchangeRateUsdToHnl: exchangeRate,
      serviceLevel,
      customsAgentComponents,
      toComponentLike: (c) => toComponentLike(c, codeMap),
    })

    const carried = overrides.filter((o) => o.scenario?.transport_type === scenario.transport_type)
    if (carried.length === 0) return scenario

    const lines = scenario.lines.map((line) => {
      const override = carried.find((o) => o.category === line.category && o.component_name === line.component_name)
      if (!override) return line
      return {
        ...line,
        amount_usd: Number(override.amount_usd),
        is_manual_override: true,
        override_reason: override.override_reason,
      }
    })
    const totals = recomputeTotalsFromCostDetails(
      scenario.result.fob,
      marginAmount,
      lines.map((l) => ({ category: l.category, amount_usd: l.amount_usd, is_tax: l.is_tax })),
    )
    return { ...scenario, lines, totals: pickTotals(totals) }
  })

  return {
    scenarios,
    serviceLevel,
    agentTariffId: agentTariff.id,
    exchangeRate,
    exchangeRateDate,
    productRows,
    excludedIdsBefore: excludedBefore.map((c) => c.id),
    excludedIdsAfter: excludedAfter.map((c) => c.id),
  }
}

async function persistRecalculation(
  tx: Prisma.TransactionClient,
  quotationId: string,
  recalculation: Recalculation,
): Promise<void> {
  const first = recalculation.scenarios[0]
  if (!first) throw new NotFoundError('Tarifa de consolidador vigente')
  const { result } = first

  await tx.quotation.update({
    where: { id: quotationId },
    data: {
      service_level: recalculation.serviceLevel,
      customs_agent_tariff_id: recalculation.agentTariffId,
      exchange_rate: recalculation.exchangeRate,
      exchange_rate_date: recalculation.exchangeRateDate,
      total_weight_kg: result.total_weight_kg,
      total_weight_lb: result.total_weight_lb,
      total_volume_cft: result.total_volume_cft,
      fob: result.fob,
      ...(recalculation.productRows
        ? { products: { deleteMany: {}, createMany: { data: recalculation.productRows } } }
        : {}),
    },
  })

  await persistScenarios(tx, quotationId, recalculation.scenarios)
  await syncSelectedScenario(tx, quotationId)
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
    input.margin_amount !== undefined ||
    input.service_level !== undefined ||
    input.excluded_component_ids !== undefined

  const auditEntries: { field_name: string; old_value: unknown; new_value: unknown }[] = []
  const trackChange = (field: string, oldValue: unknown, newValue: unknown): void => {
    if (isPastDraft && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      auditEntries.push({ field_name: field, old_value: oldValue, new_value: newValue })
    }
  }

  const data: Prisma.QuotationUpdateInput = pickDefined({
    observations: input.observations,
    internal_notes: input.internal_notes,
  })

  if (input.observations !== undefined) trackChange('observations', quotation.observations, input.observations)
  if (input.internal_notes !== undefined) trackChange('internal_notes', quotation.internal_notes, input.internal_notes)

  const recalculation = affectsCalculation
    ? await recalculateQuotation(quotation, {
        refresh: PRE_SEND_STATUSES.has(quotation.status),
        ...(input.products !== undefined ? { products: input.products } : {}),
        ...(input.margin_amount !== undefined ? { marginAmount: input.margin_amount } : {}),
        ...(input.service_level !== undefined ? { serviceLevel: input.service_level } : {}),
        ...(input.excluded_component_ids !== undefined ? { excludedIds: input.excluded_component_ids } : {}),
      })
    : null

  if (recalculation) {
    if (input.excluded_component_ids !== undefined) {
      trackChange(
        'excluded_component_ids',
        [...recalculation.excludedIdsBefore].sort(),
        [...recalculation.excludedIdsAfter].sort(),
      )
    }
    if (input.margin_amount !== undefined) {
      trackChange('margin_amount', Number(quotation.margin_amount), input.margin_amount)
    }
    if (input.service_level !== undefined) trackChange('service_level', quotation.service_level, input.service_level)
  }

  return prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) await tx.quotation.update({ where: { id }, data })
    if (recalculation) await persistRecalculation(tx, id, recalculation)

    const updated = await loadQuotationDetail(tx, id)
    if (recalculation) trackChange('total_cost', Number(quotation.total_cost), Number(updated.total_cost))

    if (auditEntries.length > 0) {
      await tx.auditDataChange.createMany({
        data: auditEntries.map((entry) => ({
          quotation_id: id,
          field_name: entry.field_name,
          old_value: JSON.stringify(entry.old_value),
          new_value: JSON.stringify(entry.new_value),
          changed_by: actingUser.id,
          reason: input.reason ?? null,
        })),
      })
    }

    return updated
  })
}

// El comercial elige con qué modo de transporte sigue la cotización. Desde ese momento el
// escenario elegido deja de ser "el más barato por defecto" y queda fijo.
export async function selectQuotationScenario(
  id: string,
  input: SelectScenarioDTO,
  actingUser: ActingUser & { permissions: Permission[] },
): Promise<QuotationDetail> {
  const quotation = await findQuotationOrThrow(id)
  assertCanAccessQuotation(quotation, actingUser)
  const isPastDraft = assertCanEditPastDraft(quotation, actingUser, input.reason)

  const scenario = await prisma.quotationScenario.findUnique({
    where: { quotation_id_transport_type: { quotation_id: id, transport_type: input.transport_type } },
  })
  if (!scenario) {
    throw new ValidationError(`El modo ${input.transport_type} no está disponible en esta cotización`)
  }

  return prisma.$transaction(async (tx) => {
    await tx.quotation.update({ where: { id }, data: { scenario_chosen: true } })
    await syncSelectedScenario(tx, id, input.transport_type)

    if (isPastDraft && quotation.transport_type !== input.transport_type) {
      await tx.auditDataChange.create({
        data: {
          quotation_id: id,
          field_name: 'transport_type',
          old_value: JSON.stringify(quotation.transport_type),
          new_value: JSON.stringify(input.transport_type),
          changed_by: actingUser.id,
          reason: input.reason ?? null,
        },
      })
    }

    return loadQuotationDetail(tx, id)
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

  // El modo solo se indica en los dos momentos en que un escenario "se compromete":
  // cuando se envía al cliente y cuando el cliente acepta.
  const targetMode = input.transport_type
  if (targetMode !== undefined && !MODE_COMMIT_STATUSES.has(input.to_status)) {
    throw new ValidationError('El modo de transporte solo se indica al enviar o al marcar la cotización como ganada')
  }
  if (targetMode !== undefined) {
    const scenario = await prisma.quotationScenario.findUnique({
      where: { quotation_id_transport_type: { quotation_id: id, transport_type: targetMode } },
    })
    if (!scenario) throw new ValidationError(`El modo ${targetMode} no está disponible en esta cotización`)
  }
  // Nunca se envía al cliente un modo que nadie confirmó: el "más barato por defecto" es solo una sugerencia.
  if (input.to_status === QuotationStatus.ENVIADA && !quotation.scenario_chosen && targetMode === undefined) {
    throw new ValidationError('Confirma el modo de transporte antes de enviar la cotización')
  }

  const timestampField = timestampFieldFor(input.to_status)
  // Al enviarla se recalcula con las tarifas y el tipo de cambio vigentes y queda congelada.
  const repricing =
    input.to_status === QuotationStatus.ENVIADA ? await recalculateQuotation(quotation, { refresh: true }) : null

  return prisma.$transaction(async (tx) => {
    if (targetMode !== undefined) {
      await tx.quotation.update({ where: { id }, data: { scenario_chosen: true } })
      await syncSelectedScenario(tx, id, targetMode)

      if (targetMode !== quotation.transport_type) {
        await tx.auditDataChange.create({
          data: {
            quotation_id: id,
            field_name: 'transport_type',
            old_value: JSON.stringify(quotation.transport_type),
            new_value: JSON.stringify(targetMode),
            changed_by: actingUser.id,
            reason: input.reason ?? `Modo elegido al pasar a ${input.to_status}`,
          },
        })
      }
    }

    if (repricing) {
      // "Antes" = ya con el modo elegido: solo cuentan los cambios por tarifa o tipo de cambio.
      const beforeRepricing = await tx.quotation.findUniqueOrThrow({ where: { id } })
      await persistRecalculation(tx, id, repricing)

      const repriced = await tx.quotation.findUniqueOrThrow({ where: { id } })
      const changes = [
        ['total_cost', Number(beforeRepricing.total_cost), Number(repriced.total_cost)],
        ['exchange_rate', Number(beforeRepricing.exchange_rate), Number(repriced.exchange_rate)],
      ] as const
      const changed = changes.filter(([, before, after]) => before !== after)
      if (changed.length > 0) {
        await tx.auditDataChange.createMany({
          data: changed.map(([field, before, after]) => ({
            quotation_id: id,
            field_name: field,
            old_value: JSON.stringify(before),
            new_value: JSON.stringify(after),
            changed_by: actingUser.id,
            reason: 'Recálculo automático al enviar (tarifas y tipo de cambio vigentes)',
          })),
        })
      }
    }

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

    // Deja constancia de QUÉ escenario se envió / aceptó, con los números de ese momento.
    const snapshotField = SCENARIO_SNAPSHOT_FIELD[input.to_status]
    if (snapshotField) {
      const committed = await tx.quotation.findUniqueOrThrow({ where: { id } })
      await tx.auditDataChange.create({
        data: {
          quotation_id: id,
          field_name: snapshotField,
          new_value: JSON.stringify({
            transport_type: committed.transport_type,
            service_level: committed.service_level,
            total_cost: Number(committed.total_cost),
            sale_price: Number(committed.sale_price),
            exchange_rate: Number(committed.exchange_rate),
          }),
          changed_by: actingUser.id,
          reason: input.to_status === QuotationStatus.ENVIADA ? 'Escenario enviado al cliente' : 'Escenario aceptado',
        },
      })
    }

    return loadQuotationDetail(tx, id)
  })
}

export type CompareRow = Prisma.QuotationGetPayload<{ include: { scenarios: true } }>

// Cada cotización con sus escenarios (solo totales), para comparar también el otro modo.
export async function compareByOpportunity(opportunityId: number): Promise<CompareRow[]> {
  return prisma.quotation.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { created_at: 'asc' },
    include: { scenarios: { orderBy: { transport_type: 'asc' } } },
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

// Recalcula los totales de UN escenario a partir de sus líneas ya guardadas y vuelve a
// reflejar el escenario elegido en la cotización (puede cambiar el más barato por defecto).
async function reapplyScenarioTotals(
  tx: Prisma.TransactionClient,
  quotation: Quotation,
  scenarioId: string | null,
): Promise<QuotationDetail> {
  if (!scenarioId) throw new ValidationError('La línea de costo no pertenece a ningún escenario')

  const lines = await tx.quotationCostDetail.findMany({ where: { scenario_id: scenarioId } })
  const totals = recomputeTotalsFromCostDetails(
    Number(quotation.fob),
    Number(quotation.margin_amount),
    lines.map((c) => ({ category: c.category, amount_usd: Number(c.amount_usd), is_tax: c.is_tax })),
  )

  await tx.quotationScenario.update({
    where: { id: scenarioId },
    data: {
      subtotal_consolidator: totals.subtotal_consolidator,
      cif: totals.cif,
      subtotal_customs_agent: totals.subtotal_customs_agent,
      total_cost: totals.total_cost,
      margin_percentage: totals.margin_percentage,
      sale_price: totals.sale_price,
      nationalization_base: totals.nationalization_base,
      nationalization_percentage: totals.nationalization_percentage,
    },
  })
  await syncSelectedScenario(tx, quotation.id)

  return loadQuotationDetail(tx, quotation.id)
}

// Deja fijo el amount_usd de una línea de costo puntual (con justificación
// obligatoria) y recalcula los totales de ese escenario a partir de las líneas
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

    const updated = await reapplyScenarioTotals(tx, quotation, costDetail.scenario_id)

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

    const updated = await reapplyScenarioTotals(tx, quotation, costDetail.scenario_id)

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
