export interface ErrorDetail {
  field: string
  message: string
}

export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details: ErrorDetail[]

  constructor(statusCode: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}
