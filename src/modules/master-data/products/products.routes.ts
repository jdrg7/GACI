import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as productsController from './products.controller'
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from './products.schema'

const router = Router()

router.use(authenticate)

router.get(
  '/',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(listProductsQuerySchema, 'query'),
  productsController.list,
)

router.get(
  '/:id',
  authorize(Permission.MASTER_DATA_VIEW),
  validate(idParamSchema, 'params'),
  productsController.getById,
)

router.post(
  '/',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(createProductSchema),
  productsController.create,
)

router.patch(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  productsController.update,
)

router.delete(
  '/:id',
  authorize(Permission.MASTER_DATA_EDIT),
  validate(idParamSchema, 'params'),
  productsController.remove,
)

export default router
