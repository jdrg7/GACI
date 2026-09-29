import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AppError, type ErrorDetail } from '../shared/errors'
import { isProduction } from '../config/env'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }

  if (err instanceof ZodError) {
    const details: ErrorDetail[] = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details },
    })
    return
  }

  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'JSON inválido en el cuerpo de la petición', details: [] },
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'El recurso ya existe', details: [] },
      })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Recurso no encontrado', details: [] },
      })
      return
    }
    if (err.code === 'P2003') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Referencia inválida: el recurso relacionado no existe',
          details: [],
        },
      })
      return
    }
  }

  if (!isProduction) {
    console.error(err)
  }

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado', details: [] },
  })
}
