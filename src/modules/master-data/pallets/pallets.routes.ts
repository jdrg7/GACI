import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as palletsController from './pallets.controller'
import { createPalletSchema, listPalletsQuerySchema, updatePalletSchema } from './pallets.schema'

const router = Router()

router.use(authenticate)

router.get(
  '/',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(listPalletsQuerySchema, 'query'),
  palletsController.list,
)

router.get(
  '/:id',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(idParamSchema, 'params'),
  palletsController.getById,
)

router.post(
  '/',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(createPalletSchema),
  palletsController.create,
)

router.patch(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  validate(updatePalletSchema),
  palletsController.update,
)

export default router
