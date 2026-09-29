import { Router } from 'express'
import { validate } from '../../middlewares/validate'
import { authLimiter } from '../../middlewares/rate-limiter'
import { loginSchema } from './auth.schema'
import * as authController from './auth.controller'

const router = Router()

router.post('/login', authLimiter, validate(loginSchema), authController.login)
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)

export default router
