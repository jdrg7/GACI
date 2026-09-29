import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Permission, Role } from '@prisma/client'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { AuthError } from '../../shared/errors'
import { getEffectivePermissions } from './permissions.util'
import type { AccessTokenPayload, AuthResult, RefreshTokenPayload, SafeUser } from './auth.types'

interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function signAccessToken(userId: string, role: Role, permissions: Permission[]): string {
  const payload: AccessTokenPayload = { sub: userId, role, permissions }
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions)
}

async function issueRefreshToken(userId: string, meta: RequestMeta): Promise<string> {
  const jti = crypto.randomUUID()
  const payload: RefreshTokenPayload = { sub: userId, jti }
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions)

  const decoded = jwt.decode(token) as { exp: number }

  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: hashToken(token),
      expires_at: new Date(decoded.exp * 1000),
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    },
  })

  return token
}

function toSafeUser(
  user: { id: string; email: string; full_name: string; role: Role },
  permissions: Permission[],
): SafeUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    permissions,
  }
}

const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas'

export async function login(
  email: string,
  password: string,
  meta: RequestMeta,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || user.deleted_at || !user.is_active) {
    throw new AuthError(INVALID_CREDENTIALS_MESSAGE)
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    throw new AuthError(INVALID_CREDENTIALS_MESSAGE)
  }

  const permissions = await getEffectivePermissions(user.id, user.role)
  const accessToken = signAccessToken(user.id, user.role, permissions)
  const refreshToken = await issueRefreshToken(user.id, meta)

  return { accessToken, refreshToken, user: toSafeUser(user, permissions) }
}

export async function refresh(refreshTokenRaw: string, meta: RequestMeta): Promise<AuthResult> {
  let payload: RefreshTokenPayload
  try {
    payload = jwt.verify(refreshTokenRaw, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
  } catch {
    throw new AuthError('Sesión inválida, vuelve a iniciar sesión')
  }

  const tokenHash = hashToken(refreshTokenRaw)
  const existing = await prisma.refreshToken.findFirst({ where: { token_hash: tokenHash } })

  if (!existing) {
    throw new AuthError('Sesión inválida, vuelve a iniciar sesión')
  }

  if (existing.revoked_at || existing.expires_at < new Date()) {
    // Reuso de un token ya rotado (o vencido guardado) — posible robo: se revoca toda la sesión.
    await prisma.refreshToken.updateMany({
      where: { user_id: existing.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    })
    throw new AuthError('Sesión inválida, vuelve a iniciar sesión')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || user.deleted_at || !user.is_active) {
    throw new AuthError('Sesión inválida, vuelve a iniciar sesión')
  }

  const permissions = await getEffectivePermissions(user.id, user.role)
  const accessToken = signAccessToken(user.id, user.role, permissions)
  const newRefreshToken = await issueRefreshToken(user.id, meta)

  const newTokenHash = hashToken(newRefreshToken)
  const newRow = await prisma.refreshToken.findFirst({
    where: { token_hash: newTokenHash },
    select: { id: true },
  })

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revoked_at: new Date(), replaced_by: newRow?.id ?? null },
  })

  return { accessToken, refreshToken: newRefreshToken, user: toSafeUser(user, permissions) }
}

export async function logout(refreshTokenRaw: string | undefined): Promise<void> {
  if (!refreshTokenRaw) return

  const tokenHash = hashToken(refreshTokenRaw)
  await prisma.refreshToken.updateMany({
    where: { token_hash: tokenHash, revoked_at: null },
    data: { revoked_at: new Date() },
  })
}
