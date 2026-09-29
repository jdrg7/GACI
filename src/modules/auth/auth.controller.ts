import type { Request, Response } from 'express'
import { env, isProduction } from '../../config/env'
import { sendSuccess } from '../../shared/utils/response'
import * as authService from './auth.service'
import type { LoginDTO } from './auth.schema'

const REFRESH_COOKIE_NAME = 'refresh_token'
const REFRESH_COOKIE_PATH = '/api/auth'

const DURATION_UNITS_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
}

function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim())
  if (!match) return 7 * DURATION_UNITS_MS.d!
  const [, amount, unit] = match
  return Number(amount) * DURATION_UNITS_MS[unit!]!
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
  })
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH })
}

function getMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  return { ipAddress: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginDTO
  const result = await authService.login(email, password, getMeta(req))
  setRefreshCookie(res, result.refreshToken)
  sendSuccess(res, { accessToken: result.accessToken, user: result.user })
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'No hay sesión activa', details: [] },
    })
    return
  }

  const result = await authService.refresh(token, getMeta(req))
  setRefreshCookie(res, result.refreshToken)
  sendSuccess(res, { accessToken: result.accessToken, user: result.user })
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined
  await authService.logout(token)
  clearRefreshCookie(res)
  sendSuccess(res, { message: 'Sesión cerrada' })
}
