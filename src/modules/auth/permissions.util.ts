import type { Permission, Role } from '@prisma/client'
import { prisma } from '../../config/database'
import { ROLE_DEFAULT_PERMISSIONS } from '../../config/constants'

export async function getEffectivePermissions(userId: string, role: Role): Promise<Permission[]> {
  const extra = await prisma.userPermission.findMany({
    where: { user_id: userId },
    select: { permission: true },
  })
  const set = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role])
  for (const { permission } of extra) set.add(permission)
  return Array.from(set)
}
