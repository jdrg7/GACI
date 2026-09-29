import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as controller from './customs-agent-tariffs.controller'
import {
  activeCustomsAgentTariffQuerySchema,
  componentParamSchema,
  createCustomsAgentTariffSchema,
  customsAgentTariffComponentSchema,
  listCustomsAgentTariffsQuerySchema,
  updateCustomsAgentTariffSchema,
} from './customs-agent-tariffs.schema'

const router = Router()

router.use(authenticate)
router.use(authorize(Permission.TARIFF_VIEW))

router.get('/', validate(listCustomsAgentTariffsQuerySchema, 'query'), controller.list)
router.get('/active', validate(activeCustomsAgentTariffQuerySchema, 'query'), controller.active)
router.get('/:id', validate(idParamSchema, 'params'), controller.getById)

router.post(
  '/',
  authorize(Permission.TARIFF_EDIT),
  validate(createCustomsAgentTariffSchema),
  controller.create,
)

router.patch(
  '/:id',
  authorize(Permission.TARIFF_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateCustomsAgentTariffSchema),
  controller.update,
)

router.post(
  '/:id/components',
  authorize(Permission.TARIFF_EDIT),
  validate(idParamSchema, 'params'),
  validate(customsAgentTariffComponentSchema),
  controller.addComponent,
)

router.patch(
  '/:id/components/:componentId',
  authorize(Permission.TARIFF_EDIT),
  validate(componentParamSchema, 'params'),
  validate(customsAgentTariffComponentSchema),
  controller.updateComponent,
)

router.delete(
  '/:id/components/:componentId',
  authorize(Permission.TARIFF_EDIT),
  validate(componentParamSchema, 'params'),
  controller.deleteComponent,
)

export default router
