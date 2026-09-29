import bcrypt from 'bcrypt'
import type { Permission, Role, User } from '@prisma/client'
import { prisma } from '../../config/database'
import { AuthError, ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { getPagination, buildPaginationMeta } from '../../shared/utils/paginate'
import type { PaginatedResult } from '../../shared/types/pagination'
import { getEffectivePermissions } from '../auth/permissions.util'
import type { ListUsersQuery, UpdateUserDTO } from './users.schema'

const PASSWORD_HASH_ROUNDS = 12

export interface UserListItem {
  id: string
  email: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: Date
}

export interface UserDetail extends UserListItem {
  permissions: Permission[]
}

function toListItem(user: User): UserListItem {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
  }
}

async function toDetail(user: User): Promise<UserDetail> {
  const permissions = await getEffectivePermissions(user.id, user.role)
  return { ...toListItem(user), permissions }
}

async function findActiveUserOrThrow(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user || user.deleted_at) {
    throw new NotFoundError('Usuario')
  }
  return user
}

export async function listUsers(query: ListUsersQuery): Promise<PaginatedResult<UserListItem>> {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    deleted_at: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    prisma.user.count({ where }),
  ])

  return { data: users.map(toListItem), meta: buildPaginationMeta(total, page, limit) }
}

export async function getUserById(id: string): Promise<UserDetail> {
  const user = await findActiveUserOrThrow(id)
  return toDetail(user)
}

export async function createUser(input: {
  email: string
  password: string
  full_name: string
  role: Role
}): Promise<UserDetail> {
  const password_hash = await bcrypt.hash(input.password, PASSWORD_HASH_ROUNDS)
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password_hash,
      full_name: input.full_name,
      role: input.role,
    },
  })
  return toDetail(user)
}

export async function updateUser(
  id: string,
  currentUserId: string,
  input: UpdateUserDTO,
): Promise<UserDetail> {
  if (id === currentUserId && (input.role !== undefined || input.is_active === false)) {
    throw new ConflictError('No puedes modificar tu propio rol o desactivar tu propia cuenta')
  }

  await findActiveUserOrThrow(id)
  const data: { full_name?: string; role?: Role; is_active?: boolean } = {}
  if (input.full_name !== undefined) data.full_name = input.full_name
  if (input.role !== undefined) data.role = input.role
  if (input.is_active !== undefined) data.is_active = input.is_active

  const user = await prisma.user.update({ where: { id }, data })
  return toDetail(user)
}

export async function softDeleteUser(id: string, currentUserId: string): Promise<void> {
  if (id === currentUserId) {
    throw new ConflictError('No puedes eliminar tu propia cuenta')
  }

  await findActiveUserOrThrow(id)
  await prisma.user.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
  })
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await findActiveUserOrThrow(userId)

  const matches = await bcrypt.compare(currentPassword, user.password_hash)
  if (!matches) {
    throw new AuthError('La contraseña actual es incorrecta')
  }

  const password_hash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS)
  await prisma.user.update({ where: { id: userId }, data: { password_hash } })

  // Cerrar todas las sesiones activas: la contraseña cambió, los refresh tokens existentes se invalidan.
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  })
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  await findActiveUserOrThrow(id)
  const password_hash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS)
  await prisma.user.update({ where: { id }, data: { password_hash } })
  await prisma.refreshToken.updateMany({
    where: { user_id: id, revoked_at: null },
    data: { revoked_at: new Date() },
  })
}

export async function grantPermission(
  id: string,
  permission: Permission,
  grantedBy: string,
): Promise<UserDetail> {
  const user = await findActiveUserOrThrow(id)

  await prisma.userPermission.upsert({
    where: { user_id_permission: { user_id: id, permission } },
    update: {},
    create: { user_id: id, permission, granted_by: grantedBy },
  })

  return toDetail(user)
}

export async function revokePermission(id: string, permission: Permission): Promise<UserDetail> {
  const user = await findActiveUserOrThrow(id)

  const existing = await prisma.userPermission.findUnique({
    where: { user_id_permission: { user_id: id, permission } },
  })
  if (!existing) {
    throw new ValidationError('El usuario no tiene ese permiso extra asignado')
  }

  await prisma.userPermission.delete({ where: { id: existing.id } })
  return toDetail(user)
}
