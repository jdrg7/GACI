import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as consolidatorsController from './consolidators.controller'
import {
  createConsolidatorSchema,
  listConsolidatorsQuerySchema,
  updateConsolidatorSchema,
} from './consolidators.schema'

const router = Router()

router.use(authenticate)

router.get(
  '/',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(listConsolidatorsQuerySchema, 'query'),
  consolidatorsController.list,
)

router.get(
  '/:id',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(idParamSchema, 'params'),
  consolidatorsController.getById,
)

router.post(
  '/',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(createConsolidatorSchema),
  consolidatorsController.create,
)

router.patch(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateConsolidatorSchema),
  consolidatorsController.update,
)

router.delete(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  consolidatorsController.remove,
)

export default router
