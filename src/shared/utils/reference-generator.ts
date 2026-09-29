import type { Prisma, PrismaClient } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient | PrismaClient

// Formato: GACI-{año}-{consecutivo de 4 dígitos}. Cuenta las cotizaciones ya
// creadas en el año actual; no es un generador de secuencia distribuido — a la
// escala de este sistema (uso interno, no alta concurrencia) es suficiente,
// y el @unique en reference_number actúa como red de seguridad ante colisiones.
export async function generateReferenceNumber(tx: TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `GACI-${year}-`

  const count = await tx.quotation.count({
    where: { reference_number: { startsWith: prefix } },
  })

  const sequence = String(count + 1).padStart(4, '0')
  return `${prefix}${sequence}`
}
