export type UserRole = 'student' | 'classLeader' | 'admin' | 'superAdmin'

export interface SessionUser {
  userId: string
  name: string
  className: string
  role: UserRole
}

export interface StudentProfile {
  userId: string
  name: string
  className: string
  gender: string
  passwordHash: string
}

export interface DynamicField {
  key: string
  label: string
  type: 'text' | 'number' | 'chinese' | 'date' | 'singleChoice'
  limit?: number
  options?: string[]
}

export interface DynamicTable {
  id: string
  name: string
  createdBy: string
  type: 'full' | 'partial'
  fields: DynamicField[]
}

export interface OperationLog {
  id: number
  timestamp: string
  operatorId: string
  operatorName: string
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout'
  target: string
  detail: string
}
