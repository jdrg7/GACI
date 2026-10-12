import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../middlewares/authenticate'
import { authorize } from '../../middlewares/authorize'
import { validate } from '../../middlewares/validate'
import { idParamSchema } from '../../shared/schemas/id-param.schema'
import * as controller from './quotations.controller'
import {
  changeStateSchema,
  compareQuerySchema,
  costDetailParamSchema,
  createQuotationSchema,
  listQuotationsQuerySchema,
  overrideCostDetailSchema,
  revertCostDetailSchema,
  selectScenarioSchema,
  updateQuotationSchema,
} from './quotations.schema'

const router = Router()

router.use(authenticate)

router.post(
  '/',
  authorize([Permission.QUOTATION_CREATE, Permission.QUOTATION_CREATE_DRAFT]),
  validate(createQuotationSchema),
  controller.create,
)

router.get(
  '/',
  authorize(Permission.QUOTATION_VIEW),
  validate(listQuotationsQuerySchema, 'query'),
  controller.list,
)

router.get(
  '/compare',
  authorize(Permission.QUOTATION_COMPARE),
  validate(compareQuerySchema, 'query'),
  controller.compare,
)

router.get(
  '/:id',
  authorize(Permission.QUOTATION_VIEW),
  validate(idParamSchema, 'params'),
  controller.getById,
)

router.patch(
  '/:id',
  authorize(Permission.QUOTATION_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateQuotationSchema),
  controller.update,
)

router.post(
  '/:id/scenario',
  authorize(Permission.QUOTATION_EDIT),
  validate(idParamSchema, 'params'),
  validate(selectScenarioSchema),
  controller.selectScenario,
)

router.post(
  '/:id/state',
  authorize(Permission.QUOTATION_CHANGE_STATE),
  validate(idParamSchema, 'params'),
  validate(changeStateSchema),
  controller.changeState,
)

router.patch(
  '/:id/cost-details/:costDetailId/override',
  authorize(Permission.QUOTATION_EDIT),
  validate(costDetailParamSchema, 'params'),
  validate(overrideCostDetailSchema),
  controller.overrideCostDetail,
)

router.delete(
  '/:id/cost-details/:costDetailId/override',
  authorize(Permission.QUOTATION_EDIT),
  validate(costDetailParamSchema, 'params'),
  validate(revertCostDetailSchema),
  controller.revertCostDetailOverride,
)

export default router
