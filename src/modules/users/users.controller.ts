import type { Request, Response } from 'express'
import { sendPaginated, sendSuccess } from '../../shared/utils/response'
import { AuthError } from '../../shared/errors'
import * as usersService from './users.service'
import type {
  ChangePasswordDTO,
  CreateUserDTO,
  GrantPermissionDTO,
  ListUsersQuery,
  ResetPasswordDTO,
  UpdateUserDTO,
} from './users.schema'

function requireUser(req: Request): { id: string } {
  if (!req.user) throw new AuthError()
  return req.user
}

export async function me(req: Request, res: Response): Promise<void> {
  const currentUser = requireUser(req)
  const user = await usersService.getUserById(currentUser.id)
  sendSuccess(res, user)
}

export async function changeOwnPassword(req: Request, res: Response): Promise<void> {
  const currentUser = requireUser(req)
  const { currentPassword, newPassword } = req.body as ChangePasswordDTO
  await usersService.changeOwnPassword(currentUser.id, currentPassword, newPassword)
  sendSuccess(res, { message: 'Contraseña actualizada' })
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListUsersQuery
  const result = await usersService.listUsers(query)
  sendPaginated(res, result.data, result.meta)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const user = await usersService.getUserById(id)
  sendSuccess(res, user)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateUserDTO
  const user = await usersService.createUser(input)
  sendSuccess(res, user, 201)
}

export async function update(req: Request, res: Response): Promise<void> {
  const currentUser = requireUser(req)
  const { id } = req.params as { id: string }
  const input = req.body as UpdateUserDTO
  const user = await usersService.updateUser(id, currentUser.id, input)
  sendSuccess(res, user)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const currentUser = requireUser(req)
  const { id } = req.params as { id: string }
  await usersService.softDeleteUser(id, currentUser.id)
  sendSuccess(res, { message: 'Usuario eliminado' })
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const { newPassword } = req.body as ResetPasswordDTO
  await usersService.resetPassword(id, newPassword)
  sendSuccess(res, { message: 'Contraseña restablecida' })
}

export async function grantPermission(req: Request, res: Response): Promise<void> {
  const currentUser = requireUser(req)
  const { id } = req.params as { id: string }
  const { permission } = req.body as GrantPermissionDTO
  const user = await usersService.grantPermission(id, permission, currentUser.id)
  sendSuccess(res, user)
}

export async function revokePermission(req: Request, res: Response): Promise<void> {
  const { id, permission } = req.params as unknown as GrantPermissionDTO & { id: string }
  const user = await usersService.revokePermission(id, permission)
  sendSuccess(res, user)
}
