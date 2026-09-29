import { AppError } from './AppError'

export class ConflictError extends AppError {
  constructor(message = 'Conflicto de negocio') {
    super(409, 'CONFLICT', message)
  }
}
