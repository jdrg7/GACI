import { z } from 'zod'
import { Permission, Role } from '@prisma/client'
import { booleanQueryParam } from '../../shared/schemas/boolean-query.schema'

const emailSchema = z
  .string()
  .email('Email inválido')
  .transform((value) => value.toLowerCase().trim())

const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')

export const userIdParamSchema = z.object({
  id: z.string().uuid('ID de usuario inválido'),
})

export const permissionParamSchema = z.object({
  id: z.string().uuid('ID de usuario inválido'),
  permission: z.nativeEnum(Permission),
})

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  role: z.nativeEnum(Role).optional(),
  is_active: booleanQueryParam,
})

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(1, 'El nombre completo es requerido').max(255),
  role: z.nativeEnum(Role),
})

export const updateUserSchema = z
  .object({
    full_name: z.string().trim().min(1).max(255).optional(),
    role: z.nativeEnum(Role).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No se envió ningún campo para actualizar' })

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: passwordSchema,
})

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
})

export const grantPermissionSchema = z.object({
  permission: z.nativeEnum(Permission),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type CreateUserDTO = z.infer<typeof createUserSchema>
export type UpdateUserDTO = z.infer<typeof updateUserSchema>
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>
export type GrantPermissionDTO = z.infer<typeof grantPermissionSchema>
