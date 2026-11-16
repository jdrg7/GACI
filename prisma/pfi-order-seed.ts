import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { basename } from 'node:path'

const LB_PER_KG = 2.2046

// Líneas del reporte PFI WR recibido el 16/06/2026.
// Un producto representa un Warehouse Receipt. Cada recibo puede traer varios
// bultos; se agregan sus pesos y sus volúmenes calculados desde las pulgadas.
// El producto se cotiza con cantidad 1 y el valor declarado total del recibo.
const PFI_ORDER_LINES = [
  {
    warehouse: '609372',
    trackingNo: '9622001900007081049900871653910206,',
    date: '05/14/2026',
    customerReference: 'TEH-62445',
    recipient: 'NCR CORP',
    packages: [
      { type: 'PC', weightLb: 6, lengthIn: 15, widthIn: 13, heightIn: 10 },
      { type: 'PC', weightLb: 1, lengthIn: 7, widthIn: 6, heightIn: 2 },
    ],
    description: 'GENERAL CARGO',
    totalValueUsd: 1131.01,
  },
  {
    warehouse: '609988',
    trackingNo: null,
    date: '05/21/2026',
    customerReference: 'TEH-62967',
    recipient: 'INTCOMEX',
    packages: [
      { type: 'PLT', weightLb: 720, lengthIn: 40, widthIn: 48, heightIn: 86 },
      { type: 'PLT', weightLb: 487, lengthIn: 40, widthIn: 48, heightIn: 58 },
    ],
    description: 'GENERAL CARGO',
    totalValueUsd: 9270.8,
  },
  {
    warehouse: '610934',
    trackingNo: '39489-341601-341451-342139-346046',
    date: '06/02/2026',
    customerReference: 'TEH-62444-63738',
    recipient: 'DATA TECH INC',
    packages: [
      { type: 'PC', weightLb: 6, lengthIn: 8, widthIn: 22, heightIn: 6 },
      { type: 'PC', weightLb: 6, lengthIn: 14, widthIn: 22, heightIn: 6 },
      { type: 'PC', weightLb: 11, lengthIn: 14, widthIn: 22, heightIn: 7 },
      { type: 'PLT', weightLb: 204, lengthIn: 40, widthIn: 48, heightIn: 29 },
    ],
    description: 'GENERAL CARGO',
    totalValueUsd: 3673.92,
  },
  {
    warehouse: '611935',
    trackingNo: '21484',
    date: '06/10/2026',
    customerReference: 'TEH-64214',
    recipient: 'ADISTEC, CORP',
    packages: [{ type: 'PC', weightLb: 7, lengthIn: 16, widthIn: 12, heightIn: 4 }],
    description: 'GENERAL CARGO',
    totalValueUsd: 713.85,
  },
  {
    warehouse: '612148',
    trackingNo: '39664-346047-346526',
    date: '06/12/2026',
    customerReference: 'TEH-63738',
    recipient: 'DATA TECH INC',
    packages: [
      { type: 'PC', weightLb: 13, lengthIn: 17, widthIn: 17, heightIn: 11 },
      { type: 'PLT', weightLb: 118, lengthIn: 48, widthIn: 40, heightIn: 20 },
    ],
    description: 'GENERAL CARGO',
    totalValueUsd: 2101.3,
  },
] as const

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

async function seedPfiOrder(prisma: PrismaClient): Promise<void> {
  console.log('📦 Guardando productos del reporte PFI...')

  for (const line of PFI_ORDER_LINES) {
    const totalWeightLb = line.packages.reduce((sum, item) => sum + item.weightLb, 0)
    const totalVolumeCft = line.packages.reduce(
      (sum, item) => sum + (item.lengthIn * item.widthIn * item.heightIn) / 1728,
      0,
    )
    const packageCount = line.packages.length
    const data = {
      name: `${line.recipient} — PFI ${line.warehouse} (${line.customerReference})`,
      description: [
        `Reporte PFI del ${line.date}; ${line.description}.`,
        `Paquetes: ${packageCount}. Peso real total: ${totalWeightLb} lb (${round(totalWeightLb / LB_PER_KG, 3)} kg).`,
        `Volumen total calculado: ${round(totalVolumeCft, 6)} CFT.`,
        `Detalle L × W × H en pulgadas: ${line.packages
          .map(
            (item, index) =>
              `${index + 1}) ${item.type}, ${item.weightLb} lb, ${item.lengthIn} × ${item.widthIn} × ${item.heightIn} in (${round((item.lengthIn * item.widthIn * item.heightIn) / 1728, 4)} CFT)`,
          )
          .join('; ')}.`,
        `Valor declarado total: USD ${line.totalValueUsd.toFixed(2)}.`,
        `Tracking: ${line.trackingNo ?? 'no indicado'}.`,
      ].join(' '),
      supplier_id: null,
      weight_kg: round(totalWeightLb / LB_PER_KG, 3),
      weight_lb: round(totalWeightLb, 3),
      volume_cft: round(totalVolumeCft, 6),
      is_active: true,
      deleted_at: null,
    }

    await prisma.product.upsert({
      where: { sku: `PFI-WR-${line.warehouse}` },
      update: data,
      create: { sku: `PFI-WR-${line.warehouse}`, ...data },
    })

    console.log(
      `  → ${line.warehouse}: ${line.recipient}, ${packageCount} paquete(s), ${data.weight_lb} lb, ${data.volume_cft} CFT`,
    )
  }

  console.log(`✅ ${PFI_ORDER_LINES.length} productos PFI listos para cotizar manualmente.`)
}

if (basename(process.argv[1] ?? '') === 'pfi-order-seed.ts') {
  const prisma = new PrismaClient()
  seedPfiOrder(prisma)
    .catch((error) => {
      console.error('❌ Error al guardar los productos PFI:', error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
