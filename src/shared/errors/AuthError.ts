import { AppError } from './AppError'

export class AuthError extends AppError {
  constructor(message = 'No autenticado') {
    super(401, 'UNAUTHENTICATED', message)
  }
}
