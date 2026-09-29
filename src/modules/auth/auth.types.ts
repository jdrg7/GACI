import type { Permission, Role } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string
  role: Role
  permissions: Permission[]
}

export interface RefreshTokenPayload {
  sub: string
  jti: string
}

export interface SafeUser {
  id: string
  email: string
  full_name: string
  role: Role
  permissions: Permission[]
}

export interface AuthResult {
  accessToken: string
  refreshToken: string
  user: SafeUser
}
