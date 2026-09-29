import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as clientsController from './clients.controller'
import { createClientSchema, listClientsQuerySchema, updateClientSchema } from './clients.schema'

const router = Router()

router.use(authenticate)

router.get(
  '/',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(listClientsQuerySchema, 'query'),
  clientsController.list,
)

router.get(
  '/:id',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(idParamSchema, 'params'),
  clientsController.getById,
)

router.post(
  '/',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(createClientSchema),
  clientsController.create,
)

router.patch(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateClientSchema),
  clientsController.update,
)

router.delete(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  clientsController.remove,
)

export default router
