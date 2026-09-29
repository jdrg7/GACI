import { Permission, Role } from '@prisma/client'

export const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.COMERCIAL]: [
    Permission.QUOTATION_CREATE,
    Permission.QUOTATION_VIEW,
    Permission.QUOTATION_EDIT,
    Permission.QUOTATION_CHANGE_STATE,
    Permission.QUOTATION_VIEW_OPP,
    Permission.MASTER_DATA_VIEW,
  ],
  [Role.OPERACIONES]: [
    Permission.QUOTATION_VIEW,
    Permission.QUOTATION_CREATE_DRAFT,
    Permission.MASTER_DATA_VIEW,
  ],
}
