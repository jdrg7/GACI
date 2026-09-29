import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

type ValidationTarget = 'body' | 'query' | 'params'

export function validate(schema: ZodType, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed: unknown = schema.parse(req[target])
    // Express 5 expone `req.query` como getter no memoizado: reasignar la propiedad
    // (en vez de mutar el objeto) es lo único que persiste el valor validado/parseado.
    Object.defineProperty(req, target, { value: parsed, writable: true, configurable: true })
    next()
  }
}
