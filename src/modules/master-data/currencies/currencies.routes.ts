import { Router } from 'express'
import { authenticate } from '../../../middlewares/authenticate'
import * as currenciesController from './currencies.controller'

const router = Router()

router.use(authenticate)
router.get('/', currenciesController.list)

export default router
