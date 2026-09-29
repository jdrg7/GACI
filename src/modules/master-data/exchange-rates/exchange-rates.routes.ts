import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import * as exchangeRatesController from './exchange-rates.controller'
import {
  createExchangeRateSchema,
  latestExchangeRateQuerySchema,
  listExchangeRatesQuerySchema,
} from './exchange-rates.schema'

const router = Router()

router.use(authenticate)

// Lectura: cualquier usuario autenticado
router.get(
  '/latest',
  validate(latestExchangeRateQuerySchema, 'query'),
  exchangeRatesController.latest,
)
router.get('/', validate(listExchangeRatesQuerySchema, 'query'), exchangeRatesController.list)

router.post(
  '/',
  authorize(Permission.EXCHANGE_RATE_EDIT),
  validate(createExchangeRateSchema),
  exchangeRatesController.create,
)

export default router
