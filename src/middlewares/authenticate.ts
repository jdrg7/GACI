import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AuthError } from '../shared/errors'
import type { AccessTokenPayload } from '../modules/auth/auth.types'

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Token de acceso no proporcionado')
  }

  const token = header.slice('Bearer '.length)

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
    req.user = {
      id: payload.sub,
      role: payload.role,
      permissions: payload.permissions,
    }
    next()
  } catch {
    throw new AuthError('Token de acceso inválido o expirado')
  }
}
