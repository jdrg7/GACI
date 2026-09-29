import { AppError } from './AppError'

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta acción') {
    super(403, 'FORBIDDEN', message)
  }
}
