/**
 * @file 前端角色判断（与后端角色名「管理员」对齐）。
 */
import type { AuthUser } from '@/store/authStore'

export function isAdminUser(user: AuthUser | null | undefined) {
  const n = user?.Role?.name ?? user?.role?.name
  return n === '管理员'
}

export function hasPermUser(userPerms: string[] | null | undefined, permCode: string) {
  const list = Array.isArray(userPerms) ? userPerms : []
  if (list.includes('*') || list.includes(permCode)) return true
  const impliedBy: Record<string, string[]> = {
    'channel:view': ['customer:view'],
    'channel:manage': ['customer:edit'],
    'ads:view': ['dashboard:view'],
    'customer:import': ['customer:edit'],
  }
  const fb = impliedBy[permCode]
  return Boolean(fb?.some((x) => list.includes(x)))
}

/** 员工管理：user:manage 或 settings:manage 任一即可 */
export function canManageStaffUser(userPerms: string[] | null | undefined) {
  return hasPermUser(userPerms, 'user:manage') || hasPermUser(userPerms, 'settings:manage')
}
