import type { Permission, Role } from '@prisma/client'

export interface AuthenticatedUser {
  id: string
  role: Role
  permissions: Permission[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export {}
