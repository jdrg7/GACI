// ============================================================
// Datos de ejemplo (solo desarrollo)
// ============================================================
// Crea productos y cotizaciones de ejemplo basados en los casos de oro del calculador de
// PFI (CALCULATOR TECNASA HONDURAS.xlsx), usando el servicio real de cotizaciones: así los
// números salen del motor actual con las tarifas vigentes de la BD.
//
// Uso:
//   pnpm prisma:samples            → agrega los ejemplos
//   pnpm prisma:samples --reset    → borra TODAS las cotizaciones primero y luego agrega los ejemplos
//
// No toca datos maestros (clientes, tarifas, etc.); solo upsert de productos SAMPLE-*.
// ============================================================

import { PrismaClient, QuotationStatus, Role, ServiceLevel } from '@prisma/client'
import { changeQuotationState, createQuotation } from '../src/modules/quotations/quotations.service'
import type { CreateQuotationDTO } from '../src/modules/quotations/quotations.schema'

const prisma = new PrismaClient()

const LB_PER_KG = 2.2046
const PFI_ID = '00000000-0000-4000-8000-000000000002'
const AGENT_ID = '00000000-0000-4000-8000-000000000005'

interface SampleProduct {
  sku: string
  name: string
  lb: number
  // largo × ancho × alto en pulgadas
  dims: [number, number, number]
}

const PRODUCTS: SampleProduct[] = [
  { sku: 'SAMPLE-PANEL-55x33x7', name: 'Panel plano 55×33×7 in (49 lb)', lb: 49, dims: [55, 33, 7] },
  { sku: 'SAMPLE-BOX-24x24x10', name: 'Caja 24×24×10 in (15 lb)', lb: 15, dims: [24, 24, 10] },
  { sku: 'SAMPLE-BOX-12x12x12', name: 'Caja 12×12×12 in (10 lb)', lb: 10, dims: [12, 12, 12] },
  { sku: 'SAMPLE-CRATE-24x24x20', name: 'Caja densa 24×24×20 in (125 lb)', lb: 125, dims: [24, 24, 20] },
  { sku: 'SAMPLE-BULKY-48x40x40', name: 'Bulto liviano 48×40×40 in (30 lb)', lb: 30, dims: [48, 40, 40] },
  { sku: 'SAMPLE-HEAVY-40x30x30', name: 'Caja pesada 40×30×30 in (250 lb)', lb: 250, dims: [40, 30, 30] },
]

interface SampleQuotation {
  label: string
  lines: { sku: string; quantity: number; fob: number }[]
  serviceLevel: ServiceLevel
  finalStatus: QuotationStatus
}

const QUOTATIONS: SampleQuotation[] = [
  {
    label: 'Caso A — Excel de PFI (452 lb, 68.49 CFT): gana el marítimo',
    lines: [
      { sku: 'SAMPLE-PANEL-55x33x7', quantity: 8, fob: 900 },
      { sku: 'SAMPLE-BOX-24x24x10', quantity: 2, fob: 350 },
      { sku: 'SAMPLE-BOX-12x12x12', quantity: 3, fob: 150 },
    ],
    serviceLevel: ServiceLevel.REGULAR,
    finalStatus: QuotationStatus.BORRADOR,
  },
  {
    label: 'Caso B — caja pequeña, todo en mínimos: gana el aéreo',
    lines: [{ sku: 'SAMPLE-BOX-12x12x12', quantity: 1, fob: 200 }],
    serviceLevel: ServiceLevel.REGULAR,
    finalStatus: QuotationStatus.BORRADOR,
  },
  {
    label: 'Caso C — carga densa, aéreo Priority (gana el peso real)',
    lines: [{ sku: 'SAMPLE-CRATE-24x24x20', quantity: 4, fob: 1500 }],
    serviceLevel: ServiceLevel.PRIORITY,
    finalStatus: QuotationStatus.PENDIENTE,
  },
  {
    label: 'Caso D — voluminosa liviana (gana el volumen)',
    lines: [{ sku: 'SAMPLE-BULKY-48x40x40', quantity: 10, fob: 400 }],
    serviceLevel: ServiceLevel.REGULAR,
    finalStatus: QuotationStatus.BORRADOR,
  },
  {
    label: 'Caso E — carga pesada, ya enviada al cliente',
    lines: [{ sku: 'SAMPLE-HEAVY-40x30x30', quantity: 10, fob: 1100 }],
    serviceLevel: ServiceLevel.REGULAR,
    finalStatus: QuotationStatus.ENVIADA,
  },
]

async function resetQuotations(): Promise<void> {
  await prisma.$transaction([
    prisma.auditDataChange.deleteMany(),
    prisma.auditStateChange.deleteMany(),
    prisma.quotationDocument.deleteMany(),
    prisma.quotationCostDetail.deleteMany(),
    prisma.quotationScenario.deleteMany(),
    prisma.quotationProduct.deleteMany(),
    prisma.quotation.deleteMany(),
  ])
  console.log('  → Cotizaciones anteriores eliminadas')
}

async function main(): Promise<void> {
  if (process.argv.includes('--reset')) await resetQuotations()

  const [admin, honduras, client] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'admin@gaci.local' } }),
    prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } }),
    prisma.client.findFirstOrThrow({ where: { deleted_at: null }, orderBy: { created_at: 'asc' } }),
  ])

  console.log('  → Productos de ejemplo...')
  const productIds = new Map<string, string>()
  for (const p of PRODUCTS) {
    const [l, w, h] = p.dims
    const data = {
      name: p.name,
      weight_lb: p.lb,
      weight_kg: Math.round((p.lb / LB_PER_KG) * 1000) / 1000,
      volume_cft: Math.round(((l * w * h) / 1728) * 1_000_000) / 1_000_000,
      is_active: true,
    }
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: data,
      create: { sku: p.sku, ...data },
    })
    productIds.set(p.sku, product.id)
  }

  console.log('  → Cotizaciones de ejemplo...')
  const actingUser = { id: admin.id, role: Role.ADMIN }
  for (const sample of QUOTATIONS) {
    const input: CreateQuotationDTO = {
      client_id: client.id,
      country_id: honduras.id,
      consolidator_id: PFI_ID,
      customs_agent_id: AGENT_ID,
      service_level: sample.serviceLevel,
      margin_amount: 0, // el margen está oculto por ahora
      observations: sample.label,
      products: sample.lines.map((line) => ({
        product_id: productIds.get(line.sku)!,
        quantity: line.quantity,
        fob_unit_price: line.fob,
      })),
    }

    let quotation = await createQuotation(input, admin.id)

    // BORRADOR → PENDIENTE → ENVIADA (al enviar se recalcula y se congela).
    const path: QuotationStatus[] = []
    if (sample.finalStatus !== QuotationStatus.BORRADOR) path.push(QuotationStatus.PENDIENTE)
    if (sample.finalStatus === QuotationStatus.ENVIADA) path.push(QuotationStatus.ENVIADA)
    for (const status of path) {
      quotation = await changeQuotationState(
        quotation.id,
        // Para enviar hay que confirmar el modo: aquí se confirma el que quedó elegido (el más barato).
        status === QuotationStatus.ENVIADA
          ? { to_status: status, transport_type: quotation.transport_type }
          : { to_status: status },
        actingUser,
        { ipAddress: null, userAgent: 'sample-data' },
      )
    }

    const air = quotation.scenarios.find((s) => s.transport_type === 'AEREO')
    const sea = quotation.scenarios.find((s) => s.transport_type === 'MARITIMO')
    console.log(
      `     ${quotation.reference_number} [${quotation.status}] ` +
        `aéreo ${air ? Number(air.total_cost).toFixed(2) : '—'} · marítimo ${sea ? Number(sea.total_cost).toFixed(2) : '—'} ` +
        `→ elegido ${quotation.transport_type}  (${sample.label})`,
    )
  }
}

main()
  .then(() => console.log('✅ Datos de ejemplo cargados'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
