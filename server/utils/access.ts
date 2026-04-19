import type { UserAccount } from './store'

export function canViewClassData(user: UserAccount): boolean {
  return user.role === 'classLeader' || user.role === 'admin' || user.role === 'superAdmin'
}

export function canManageAllStudents(user: UserAccount): boolean {
  return user.role === 'admin' || user.role === 'superAdmin'
}

export function canManageTables(user: UserAccount): boolean {
  return user.role === 'admin' || user.role === 'superAdmin'
}

export function canViewLogs(user: UserAccount): boolean {
  return user.role === 'admin' || user.role === 'superAdmin'
}

export function isSuperAdmin(user: UserAccount): boolean {
  return user.role === 'superAdmin'
}
