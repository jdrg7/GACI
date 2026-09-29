import { AppError, type ErrorDetail } from './AppError'

export class ValidationError extends AppError {
  constructor(message = 'Datos inválidos', details: ErrorDetail[] = []) {
    super(400, 'VALIDATION_ERROR', message, details)
  }
}
