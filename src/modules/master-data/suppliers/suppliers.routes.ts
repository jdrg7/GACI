import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as suppliersController from './suppliers.controller'
import { createSupplierSchema, listSuppliersQuerySchema, updateSupplierSchema } from './suppliers.schema'

const router = Router()

router.use(authenticate)

router.get(
  '/',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(listSuppliersQuerySchema, 'query'),
  suppliersController.list,
)

router.get(
  '/:id',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(idParamSchema, 'params'),
  suppliersController.getById,
)

router.post(
  '/',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(createSupplierSchema),
  suppliersController.create,
)

router.patch(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateSupplierSchema),
  suppliersController.update,
)

router.delete(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  suppliersController.remove,
)

export default router
