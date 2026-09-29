import express, { type Express } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { env, isProduction } from './env'
import { prisma } from './database'
import { errorHandler } from '../middlewares/error-handler'
import { generalLimiter } from '../middlewares/rate-limiter'
import { sendSuccess } from '../shared/utils/response'
import authRoutes from '../modules/auth/auth.routes'
import usersRoutes from '../modules/users/users.routes'
import masterDataRoutes from '../modules/master-data/master-data.routes'
import tariffsRoutes from '../modules/tariffs/tariffs.routes'
import quotationsRoutes from '../modules/quotations/quotations.routes'

export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  )
  app.use(generalLimiter)
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(morgan(isProduction ? 'combined' : 'dev'))

  app.get('/health', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      sendSuccess(res, { status: 'ok', database: 'connected' })
    } catch (err) {
      next(err)
    }
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/master-data', masterDataRoutes)
  app.use('/api/tariffs', tariffsRoutes)
  app.use('/api/quotations', quotationsRoutes)

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Ruta no encontrada', details: [] },
    })
  })

  app.use(errorHandler)

  return app
}
