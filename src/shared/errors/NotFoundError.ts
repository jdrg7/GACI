import { AppError } from './AppError'

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(404, 'NOT_FOUND', `${resource} no encontrado`)
  }
}
