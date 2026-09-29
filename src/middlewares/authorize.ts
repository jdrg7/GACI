import type { NextFunction, Request, Response } from 'express'
import type { Permission } from '@prisma/client'
import { AuthError, ForbiddenError } from '../shared/errors'

/** Requiere el permiso, o al menos uno de la lista si se pasa un array (OR, no AND). */
export function authorize(permission: Permission | Permission[]) {
  const required = Array.isArray(permission) ? permission : [permission]

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthError()
    }

    if (!required.some((p) => req.user!.permissions.includes(p))) {
      throw new ForbiddenError()
    }

    next()
  }
}
