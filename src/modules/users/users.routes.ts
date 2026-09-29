import { Router } from 'express'
import { Permission } from '@prisma/client'
import { authenticate } from '../../middlewares/authenticate'
import { authorize } from '../../middlewares/authorize'
import { validate } from '../../middlewares/validate'
import * as usersController from './users.controller'
import {
  changePasswordSchema,
  createUserSchema,
  grantPermissionSchema,
  listUsersQuerySchema,
  permissionParamSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdParamSchema,
} from './users.schema'

const router = Router()

router.use(authenticate)

// Self-service
router.get('/me', usersController.me)
router.patch('/me/password', validate(changePasswordSchema), usersController.changeOwnPassword)

// Gestión de usuarios
router.get('/', authorize(Permission.USER_MANAGE), validate(listUsersQuerySchema, 'query'), usersController.list)

router.get(
  '/:id',
  authorize(Permission.USER_MANAGE),
  validate(userIdParamSchema, 'params'),
  usersController.getById,
)

router.post(
  '/',
  authorize(Permission.USER_MANAGE),
  validate(createUserSchema),
  usersController.create,
)

router.patch(
  '/:id',
  authorize(Permission.USER_MANAGE),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  usersController.update,
)

router.delete(
  '/:id',
  authorize(Permission.USER_MANAGE),
  validate(userIdParamSchema, 'params'),
  usersController.remove,
)

router.patch(
  '/:id/reset-password',
  authorize(Permission.USER_MANAGE),
  validate(userIdParamSchema, 'params'),
  validate(resetPasswordSchema),
  usersController.resetPassword,
)

// Permisos extra
router.post(
  '/:id/permissions',
  authorize(Permission.ROLE_MANAGE),
  validate(userIdParamSchema, 'params'),
  validate(grantPermissionSchema),
  usersController.grantPermission,
)

router.delete(
  '/:id/permissions/:permission',
  authorize(Permission.ROLE_MANAGE),
  validate(permissionParamSchema, 'params'),
  usersController.revokePermission,
)

export default router
