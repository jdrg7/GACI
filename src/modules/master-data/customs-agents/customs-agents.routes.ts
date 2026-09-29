import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as customsAgentsController from './customs-agents.controller'
import {
  createCustomsAgentSchema,
  listCustomsAgentsQuerySchema,
  updateCustomsAgentSchema,
} from './customs-agents.schema'

const router = Router()

router.use(authenticate)

router.get(
  '/',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(listCustomsAgentsQuerySchema, 'query'),
  customsAgentsController.list,
)

router.get(
  '/:id',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(idParamSchema, 'params'),
  customsAgentsController.getById,
)

router.post(
  '/',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(createCustomsAgentSchema),
  customsAgentsController.create,
)

router.patch(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateCustomsAgentSchema),
  customsAgentsController.update,
)

router.delete(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  customsAgentsController.remove,
)

export default router
