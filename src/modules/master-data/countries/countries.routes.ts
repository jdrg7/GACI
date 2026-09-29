import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../../middlewares/authenticate'
import { authorize } from '../../../middlewares/authorize'
import { validate } from '../../../middlewares/validate'
import { idParamSchema } from '../../../shared/schemas/id-param.schema'
import * as countriesController from './countries.controller'
import { createCountrySchema, listCountriesQuerySchema, updateCountrySchema } from './countries.schema'

const router = Router()

router.use(authenticate)

// Lectura: cualquier usuario autenticado (dato de referencia para cotizaciones)
router.get('/', validate(listCountriesQuerySchema, 'query'), countriesController.list)
router.get('/:id', validate(idParamSchema, 'params'), countriesController.getById)

router.post(
  '/',
  authorize(Permission.COUNTRY_CONFIG_EDIT),
  validate(createCountrySchema),
  countriesController.create,
)

router.patch(
  '/:id',
  authorize(Permission.COUNTRY_CONFIG_EDIT),
  validate(idParamSchema, 'params'),
  validate(updateCountrySchema),
  countriesController.update,
)

export default router
