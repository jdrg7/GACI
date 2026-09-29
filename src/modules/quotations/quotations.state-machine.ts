import { QuotationStatus } from '@prisma/client'
import { ConflictError, ValidationError } from '../../shared/errors'

// Máquina de estados confirmada por el negocio (no inferida). ALTERNATIVA
// representa cotizaciones hermanas bajo el mismo OPP que no fueron la elegida
// para enviar al cliente — se marcan así desde PENDIENTE, y pueden reactivarse
// a ENVIADA después si la elegida cae (ej. es rechazada), o cancelarse.
const TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.BORRADOR]: [QuotationStatus.PENDIENTE, QuotationStatus.CANCELADA],
  [QuotationStatus.PENDIENTE]: [
    QuotationStatus.ENVIADA,
    QuotationStatus.ALTERNATIVA,
    QuotationStatus.CANCELADA,
  ],
  [QuotationStatus.ENVIADA]: [QuotationStatus.VIGENTE, QuotationStatus.CANCELADA],
  [QuotationStatus.VIGENTE]: [
    QuotationStatus.GANADA,
    QuotationStatus.RECHAZADA,
    QuotationStatus.CANCELADA,
  ],
  [QuotationStatus.GANADA]: [
    QuotationStatus.EN_PROCESO,
    QuotationStatus.VIGENTE, // volver atrás
    QuotationStatus.CANCELADA,
  ],
  [QuotationStatus.EN_PROCESO]: [QuotationStatus.CERRADA],
  [QuotationStatus.ALTERNATIVA]: [QuotationStatus.ENVIADA, QuotationStatus.CANCELADA],
  [QuotationStatus.RECHAZADA]: [QuotationStatus.ARCHIVADA],
  [QuotationStatus.CANCELADA]: [QuotationStatus.ARCHIVADA],
  [QuotationStatus.CERRADA]: [QuotationStatus.ARCHIVADA],
  [QuotationStatus.ARCHIVADA]: [],
}

const REASON_REQUIRED = new Set<QuotationStatus>([QuotationStatus.RECHAZADA, QuotationStatus.CANCELADA])

const TIMESTAMP_FIELD: Partial<Record<QuotationStatus, string>> = {
  [QuotationStatus.ENVIADA]: 'sent_at',
  [QuotationStatus.GANADA]: 'won_at',
  [QuotationStatus.CERRADA]: 'closed_at',
  [QuotationStatus.ARCHIVADA]: 'archived_at',
}

export function assertValidTransition(
  from: QuotationStatus,
  to: QuotationStatus,
  reason: string | undefined,
): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`No se puede pasar de ${from} a ${to}`)
  }
  if (REASON_REQUIRED.has(to) && !reason?.trim()) {
    throw new ValidationError(`Se requiere una razón para pasar a ${to}`)
  }
}

export function timestampFieldFor(to: QuotationStatus): string | undefined {
  return TIMESTAMP_FIELD[to]
}
