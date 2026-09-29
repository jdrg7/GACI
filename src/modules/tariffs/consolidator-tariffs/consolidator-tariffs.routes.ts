import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as controller from './consolidator-tariffs.controller'
import {
  activeConsolidatorTariffQuerySchema,
  componentParamSchema,
  consolidatorTariffComponentSchema,
  createConsolidatorTariffSchema,
  listConsolidatorTariffsQuerySchema,
  updateConsolidatorTariffSchema,
} from './consolidator-tariffs.schema'

const router = Router()

router.use(authenticate)
router.use(authorize(Permission.TARIFF_VIEW))

router.get('/', validate(listConsolidatorTariffsQuerySchema, 'query'), controller.list)
router.get('/active', validate(activeConsolidatorTariffQuerySchema, 'query'), controller.active)
router.get('/:id', validate(idParamSchema, 'params'), controller.getById)

router.post(
  '/',
  authorize(Permission.TARIFF_EDIT),
  validate(createConsolidatorTariffSchema),
  controller.create,
)

router.patch(
  '/:id',
  authorize(Permission.TARIFF_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateConsolidatorTariffSchema),
  controller.update,
)

router.post(
  '/:id/components',
  authorize(Permission.TARIFF_EDIT),
  validate(idParamSchema, 'params'),
  validate(consolidatorTariffComponentSchema),
  controller.addComponent,
)

router.patch(
  '/:id/components/:componentId',
  authorize(Permission.TARIFF_EDIT),
  validate(componentParamSchema, 'params'),
  validate(consolidatorTariffComponentSchema),
  controller.updateComponent,
)

router.delete(
  '/:id/components/:componentId',
  authorize(Permission.TARIFF_EDIT),
  validate(componentParamSchema, 'params'),
  controller.deleteComponent,
)

export default router
