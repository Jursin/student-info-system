import { hashPassword } from './security'
import { prisma } from './prisma'

export type UserRole = 'student' | 'classLeader' | 'admin' | 'superAdmin'
export type TableType = 'full' | 'partial'

export interface UserAccount {
  userId: string
  name: string
  className: string
  role: UserRole
  passwordHash: string
  failedAttempts: number
  lockUntil: Date | null
}

export interface StudentProfile {
  userId: string
  name: string
  className: string
  gender: string
  birthDate: string
  phone: string
  address: string
  guardianPhone: string
  major: string
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
  type: TableType
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

export const BASIC_INFO_TABLE_ID = 'basic-info'
export const BASIC_INFO_LOCKED_FIELDS: DynamicField[] = [
  { key: 'userId', label: '用户名/学号', type: 'number' },
  { key: 'name', label: '姓名', type: 'chinese' },
  { key: 'gender', label: '性别', type: 'singleChoice', options: ['男', '女'] },
  { key: 'className', label: '班级', type: 'text' }
]
export const SHARED_LOCKED_FIELD_KEYS = ['userId', 'name']

const seedUsers: Array<{
  userId: string
  name: string
  className: string
  role: UserRole
  password: string
}> = [
  {
    userId: 'superadmin',
    name: '超级管理员',
    className: '',
    role: 'superAdmin',
    password: 'SuAdmin123'
  }
]

const seedProfiles: StudentProfile[] = []

const seedTables: DynamicTable[] = [
  {
    id: BASIC_INFO_TABLE_ID,
    name: '基本信息',
    createdBy: 'system',
    type: 'full',
    fields: BASIC_INFO_LOCKED_FIELDS
  }
]

let seedPromise: Promise<void> | null = null

function toUserRole(role: string): UserRole {
  return role as UserRole
}

function toOperationAction(action: string): OperationLog['action'] {
  return action as OperationLog['action']
}

function toTableType(type: string): TableType {
  return type as TableType
}

function normalizeFieldOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function normalizeDynamicFieldKeyFromDb(key: string): string {
  return key === 'userId' ? 'userId' : key
}

function normalizeDynamicFieldKeyToDb(key: string): string {
  return key === 'userId' ? 'userId' : key
}

export async function ensureSeedData(): Promise<void> {
  if (seedPromise) {
    return seedPromise
  }

  seedPromise = (async () => {
    const count = await prisma.userAccount.count()
    if (count > 0) {
      return
    }

    await prisma.$transaction(async (tx) => {
      for (const user of seedUsers) {
        await tx.userAccount.create({
          data: {
            userId: user.userId,
            name: user.name,
            className: user.className,
            role: user.role,
            passwordHash: hashPassword(user.password),
            failedAttempts: 0,
            lockUntil: null
          }
        })
      }

      for (const profile of seedProfiles) {
        await tx.studentProfile.create({ data: profile })
      }

      for (const table of seedTables) {
        await tx.dynamicTable.create({
          data: {
            id: table.id,
            name: table.name,
            createdBy: table.createdBy,
            type: table.type,
            fields: {
              create: table.fields.map(field => ({
                key: field.key,
                label: field.label,
                type: field.type,
                limit: field.limit,
                options: field.options
              }))
            }
          }
        })
      }
    })
  })()

  return seedPromise
}

export async function findUserByUserId(userId: string): Promise<UserAccount | null> {
  await ensureSeedData()

  const user = await prisma.userAccount.findUnique({ where: { userId } })
  if (!user) {
    return null
  }

  return {
    userId: user.userId,
    name: user.name,
    className: user.className,
    role: toUserRole(user.role),
    passwordHash: user.passwordHash,
    failedAttempts: user.failedAttempts,
    lockUntil: user.lockUntil
  }
}

export async function updateUserAuthState(params: {
  userId: string
  failedAttempts?: number
  lockUntil?: Date | null
  passwordHash?: string
}): Promise<void> {
  await ensureSeedData()

  await prisma.userAccount.update({
    where: { userId: params.userId },
    data: {
      ...(params.failedAttempts === undefined ? {} : { failedAttempts: params.failedAttempts }),
      ...(params.lockUntil === undefined ? {} : { lockUntil: params.lockUntil }),
      ...(params.passwordHash === undefined ? {} : { passwordHash: params.passwordHash })
    }
  })
}

export async function upsertSessionToken(params: {
  token: string
  userId: string
  expiresAt: Date
}): Promise<void> {
  await ensureSeedData()

  await prisma.sessionToken.upsert({
    where: { token: params.token },
    update: {
      userId: params.userId,
      expiresAt: params.expiresAt
    },
    create: {
      token: params.token,
      userId: params.userId,
      expiresAt: params.expiresAt
    }
  })
}

export async function deleteSessionToken(token: string): Promise<void> {
  await ensureSeedData()

  await prisma.sessionToken.deleteMany({ where: { token } })
}

export async function findSessionUserByToken(token: string): Promise<UserAccount | null> {
  await ensureSeedData()

  const session = await prisma.sessionToken.findUnique({
    where: { token },
    include: { user: true }
  })

  if (!session) {
    return null
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.sessionToken.deleteMany({ where: { token } })
    return null
  }

  return {
    userId: session.user.userId,
    name: session.user.name,
    className: session.user.className,
    role: toUserRole(session.user.role),
    passwordHash: session.user.passwordHash,
    failedAttempts: session.user.failedAttempts,
    lockUntil: session.user.lockUntil
  }
}

export async function getStudentProfileByUserId(userId: string): Promise<StudentProfile | null> {
  await ensureSeedData()

  const profile = await prisma.studentProfile.findUnique({ where: { userId } })
  if (!profile) {
    return null
  }

  return profile
}

export async function listStudentProfiles(params?: {
  userId?: string
  className?: string
}): Promise<StudentProfile[]> {
  await ensureSeedData()

  return prisma.studentProfile.findMany({
    where: {
      ...(params?.userId ? { userId: params.userId } : {}),
      ...(params?.className ? { className: params.className } : {})
    },
    orderBy: { userId: 'asc' }
  })
}

export async function createStudentProfile(profile: StudentProfile): Promise<StudentProfile> {
  await ensureSeedData()

  return prisma.$transaction(async (tx) => {
    const createdProfile = await tx.studentProfile.create({
      data: profile
    })

    const account = await tx.userAccount.findUnique({ where: { userId: profile.userId } })
    if (!account) {
      await tx.userAccount.create({
        data: {
          userId: profile.userId,
          name: profile.name,
          className: profile.className,
          role: 'student',
          passwordHash: profile.passwordHash,
          failedAttempts: 0,
          lockUntil: null
        }
      })
    }

    return createdProfile
  })
}

export async function ensureStudentAccountByUserId(userId: string): Promise<UserAccount | null> {
  await ensureSeedData()

  const exists = await prisma.userAccount.findUnique({ where: { userId } })
  if (exists) {
    return {
      userId: exists.userId,
      name: exists.name,
      className: exists.className,
      role: toUserRole(exists.role),
      passwordHash: exists.passwordHash,
      failedAttempts: exists.failedAttempts,
      lockUntil: exists.lockUntil
    }
  }

  const profile = await prisma.studentProfile.findUnique({ where: { userId } })
  if (!profile) {
    return null
  }

  const created = await prisma.userAccount.create({
    data: {
      userId: profile.userId,
      name: profile.name,
      className: profile.className,
      role: 'student',
      passwordHash: profile.passwordHash,
      failedAttempts: 0,
      lockUntil: null
    }
  })

  return {
    userId: created.userId,
    name: created.name,
    className: created.className,
    role: toUserRole(created.role),
    passwordHash: created.passwordHash,
    failedAttempts: created.failedAttempts,
    lockUntil: created.lockUntil
  }
}

export async function updateStudentProfile(userId: string, body: Partial<StudentProfile>): Promise<StudentProfile | null> {
  await ensureSeedData()

  const exists = await prisma.studentProfile.findUnique({ where: { userId } })
  if (!exists) {
    return null
  }

  return prisma.studentProfile.update({
    where: { userId },
    data: {
      ...(body.gender === undefined ? {} : { gender: body.gender }),
      ...(body.birthDate === undefined ? {} : { birthDate: body.birthDate }),
      ...(body.phone === undefined ? {} : { phone: body.phone }),
      ...(body.address === undefined ? {} : { address: body.address }),
      ...(body.guardianPhone === undefined ? {} : { guardianPhone: body.guardianPhone }),
      ...(body.major === undefined ? {} : { major: body.major }),
      ...(body.passwordHash === undefined ? {} : { passwordHash: body.passwordHash })
    }
  })
}

export async function deleteStudentProfile(userId: string): Promise<boolean> {
  await ensureSeedData()

  const result = await prisma.$transaction(async (tx) => {
    await tx.dynamicTableRow.deleteMany({ where: { userId } })
    return tx.studentProfile.deleteMany({ where: { userId } })
  })

  return result.count > 0
}

export async function clearStudentProfiles(): Promise<void> {
  await ensureSeedData()
  await prisma.studentProfile.deleteMany({})
}

export async function listDynamicTables(): Promise<DynamicTable[]> {
  await ensureSeedData()

  const tables = await prisma.dynamicTable.findMany({
    include: {
      fields: {
        orderBy: { id: 'asc' }
      }
    },
    orderBy: { id: 'asc' }
  })

  return tables.map(table => ({
    id: table.id,
    name: table.name,
    createdBy: table.createdBy,
    type: toTableType(table.type),
    fields: table.fields.map(field => ({
      key: normalizeDynamicFieldKeyFromDb(field.key),
      label: field.label,
      type: field.type as DynamicField['type'],
      limit: field.limit ?? undefined,
      options: normalizeFieldOptions(field.options)
    }))
  }))
}

export async function createDynamicTable(params: {
  id: string
  name: string
  createdBy: string
  type: TableType
  fields: DynamicField[]
}): Promise<void> {
  await ensureSeedData()

  await prisma.dynamicTable.create({
    data: {
      id: params.id,
      name: params.name,
      createdBy: params.createdBy,
      type: params.type,
      fields: {
        create: params.fields.map(field => ({
          key: normalizeDynamicFieldKeyToDb(field.key),
          label: field.label,
          type: field.type,
          limit: field.limit,
          options: field.options
        }))
      }
    }
  })
}

export async function findDynamicTableById(id: string): Promise<DynamicTable | null> {
  await ensureSeedData()

  const table = await prisma.dynamicTable.findUnique({
    where: { id },
    include: { fields: { orderBy: { id: 'asc' } } }
  })

  if (!table) {
    return null
  }

  return {
    id: table.id,
    name: table.name,
    createdBy: table.createdBy,
    type: toTableType(table.type),
    fields: table.fields.map(field => ({
      key: normalizeDynamicFieldKeyFromDb(field.key),
      label: field.label,
      type: field.type as DynamicField['type'],
      limit: field.limit ?? undefined,
      options: normalizeFieldOptions(field.options)
    }))
  }
}

export async function updateDynamicTableById(id: string, params: {
  name?: string
  type?: TableType
  fields?: DynamicField[]
}): Promise<DynamicTable | null> {
  await ensureSeedData()

  const exists = await prisma.dynamicTable.findUnique({ where: { id } })
  if (!exists) {
    return null
  }

  await prisma.dynamicTable.update({
    where: { id },
    data: {
      ...(params.name === undefined ? {} : { name: params.name }),
      ...(params.type === undefined ? {} : { type: params.type }),
      ...(params.fields === undefined
        ? {}
        : {
            fields: {
              deleteMany: {},
              create: params.fields.map(field => ({
                key: normalizeDynamicFieldKeyToDb(field.key),
                label: field.label,
                type: field.type,
                limit: field.limit,
                options: field.options
              }))
            }
          })
    }
  })

  return findDynamicTableById(id)
}

export async function deleteDynamicTableById(id: string): Promise<boolean> {
  await ensureSeedData()

  const result = await prisma.dynamicTable.deleteMany({ where: { id } })
  return result.count > 0
}

export async function listDynamicTableUserIds(tableId: string): Promise<string[]> {
  await ensureSeedData()

  const rows = await prisma.dynamicTableRow.findMany({
    where: { tableId },
    select: { userId: true },
    orderBy: { id: 'asc' }
  })

  return rows.map(row => row.userId)
}

export async function addStudentToDynamicTable(tableId: string, userId: string): Promise<void> {
  await ensureSeedData()

  await prisma.dynamicTableRow.upsert({
    where: {
      tableId_userId: {
        tableId,
        userId
      }
    },
    update: {},
    create: {
      tableId,
      userId
    }
  })
}

export async function createOperationLog(params: {
  operatorId: string
  operatorName: string
  action: OperationLog['action']
  target: string
  detail: string
}): Promise<void> {
  await ensureSeedData()

  await prisma.operationLog.create({
    data: {
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      action: params.action,
      target: params.target,
      detail: params.detail
    }
  })
}

export async function listOperationLogs(params?: {
  action?: string
  target?: string
  keyword?: string
  includeRead?: boolean
}): Promise<OperationLog[]> {
  await ensureSeedData()

  const logs = await prisma.operationLog.findMany({
    where: {
      ...(params?.action ? { action: params.action as OperationLog['action'] } : {}),
      ...(params?.target ? { target: { contains: params.target } } : {}),
      ...(!params?.includeRead ? { action: { not: 'read' } } : {})
    },
    orderBy: { timestamp: 'desc' }
  })

  const operatorIds = [...new Set(logs.map(log => log.operatorId))]
  const operators = operatorIds.length
    ? await prisma.userAccount.findMany({
        where: { userId: { in: operatorIds } },
        select: { userId: true, role: true }
      })
    : []
  const operatorRoleMap = new Map(operators.map(item => [item.userId, item.role]))

  const allowedLogs = logs.filter((log) => {
    const role = operatorRoleMap.get(log.operatorId)
    if (!role) {
      return false
    }

    const isPrivilegedLogin = log.action === 'login'
      && (role === 'admin' || role === 'superAdmin' || role === 'classLeader')
    const isTableMutationByAdmin = (log.action === 'create' || log.action === 'update' || log.action === 'delete')
      && log.target === 'tables'
      && (role === 'admin' || role === 'superAdmin')

    return isPrivilegedLogin || isTableMutationByAdmin
  })

  const keyword = params?.keyword?.trim().toLowerCase()
  const actionLabelMap: Record<OperationLog['action'], string> = {
    login: '登录',
    logout: '退出',
    create: '新增',
    read: '查看',
    update: '修改',
    delete: '删除'
  }

  const filteredLogs = keyword
    ? allowedLogs.filter(log => [
        log.operatorName,
        log.target,
        log.detail,
        log.action,
        actionLabelMap[log.action]
      ].some(value => String(value).toLowerCase().includes(keyword)))
    : allowedLogs

  return filteredLogs.map(log => ({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    operatorId: log.operatorId,
    operatorName: log.operatorName,
    action: toOperationAction(log.action),
    target: log.target,
    detail: log.detail
  }))
}

export async function clearOperationLogs(params?: {
  startAt?: Date
  endAt?: Date
}): Promise<number> {
  await ensureSeedData()

  const result = await prisma.operationLog.deleteMany({
    where: {
      ...(params?.startAt || params?.endAt
        ? {
            timestamp: {
              ...(params?.startAt ? { gte: params.startAt } : {}),
              ...(params?.endAt ? { lte: params.endAt } : {})
            }
          }
        : {})
    }
  })

  return result.count
}

export async function listUserAccounts(params?: {
  roles?: UserRole[]
}): Promise<UserAccount[]> {
  await ensureSeedData()

  const users = await prisma.userAccount.findMany({
    where: params?.roles?.length
      ? {
          role: {
            in: params.roles
          }
        }
      : undefined,
    orderBy: { userId: 'asc' }
  })

  return users.map(user => ({
    userId: user.userId,
    name: user.name,
    className: user.className,
    role: toUserRole(user.role),
    passwordHash: user.passwordHash,
    failedAttempts: user.failedAttempts,
    lockUntil: user.lockUntil
  }))
}

export async function countDistinctUserRoles(): Promise<number> {
  await ensureSeedData()

  const users = await prisma.userAccount.findMany({
    select: {
      role: true
    }
  })

  return new Set(users.map(user => user.role)).size
}

export async function createUserAccount(params: {
  userId: string
  name: string
  className: string
  role: UserRole
  password: string
}): Promise<UserAccount> {
  await ensureSeedData()

  const created = await prisma.userAccount.create({
    data: {
      userId: params.userId,
      name: params.name,
      className: params.className,
      role: params.role,
      passwordHash: hashPassword(params.password),
      failedAttempts: 0,
      lockUntil: null
    }
  })

  return {
    userId: created.userId,
    name: created.name,
    className: created.className,
    role: toUserRole(created.role),
    passwordHash: created.passwordHash,
    failedAttempts: created.failedAttempts,
    lockUntil: created.lockUntil
  }
}

export async function updateUserAccountByUserId(userId: string, params: {
  nextUserId?: string
  name?: string
  className?: string
  role?: UserRole
  password?: string
}): Promise<UserAccount | null> {
  await ensureSeedData()

  const current = await prisma.userAccount.findUnique({ where: { userId } })
  if (!current) {
    return null
  }

  const nextUserId = params.nextUserId?.trim() || userId
  if (nextUserId !== userId) {
    const exists = await prisma.userAccount.findUnique({ where: { userId: nextUserId } })
    if (exists) {
      throw createError({ statusCode: 400, message: '用户名或学号已存在' })
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userAccount.update({
      where: { userId },
      data: {
        userId: nextUserId,
        ...(params.name === undefined ? {} : { name: params.name }),
        ...(params.className === undefined ? {} : { className: params.className }),
        ...(params.role === undefined ? {} : { role: params.role }),
        ...(params.password === undefined ? {} : { passwordHash: hashPassword(params.password) }),
        failedAttempts: 0,
        lockUntil: null
      }
    })

    if (nextUserId !== userId) {
      await tx.sessionToken.updateMany({
        where: { userId },
        data: { userId: nextUserId }
      })
    }
  })

  const updated = await prisma.userAccount.findUnique({ where: { userId: nextUserId } })
  if (!updated) {
    return null
  }

  return {
    userId: updated.userId,
    name: updated.name,
    className: updated.className,
    role: toUserRole(updated.role),
    passwordHash: updated.passwordHash,
    failedAttempts: updated.failedAttempts,
    lockUntil: updated.lockUntil
  }
}

export async function deleteUserAccountByUserId(userId: string): Promise<boolean> {
  await ensureSeedData()

  const result = await prisma.userAccount.deleteMany({ where: { userId } })
  await prisma.sessionToken.deleteMany({ where: { userId } })
  return result.count > 0
}

export async function updateStudentRecord(userId: string, body: {
  nextUserId?: string
  name?: string
  className?: string
  gender?: string
  birthDate?: string
  phone?: string
  address?: string
  guardianPhone?: string
  major?: string
}): Promise<StudentProfile | null> {
  await ensureSeedData()

  const profile = await prisma.studentProfile.findUnique({ where: { userId } })
  if (!profile) {
    return null
  }

  const account = await prisma.userAccount.findUnique({ where: { userId } })
  const targetUserId = body.nextUserId?.trim() || userId

  if (targetUserId !== userId) {
    const exists = await prisma.studentProfile.findUnique({ where: { userId: targetUserId } })
    if (exists) {
      throw createError({ statusCode: 400, message: '学号已存在' })
    }
  }

  await prisma.$transaction(async (tx) => {
    if (account) {
      await tx.userAccount.update({
        where: { userId },
        data: {
          userId: targetUserId,
          ...(body.name === undefined ? {} : { name: body.name }),
          ...(body.className === undefined ? {} : { className: body.className })
        }
      })
    }

    if (targetUserId !== userId) {
      await tx.sessionToken.updateMany({
        where: { userId },
        data: { userId: targetUserId }
      })
    }

    await tx.studentProfile.update({
      where: { userId },
      data: {
        userId: targetUserId,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.className === undefined ? {} : { className: body.className }),
        ...(body.gender === undefined ? {} : { gender: body.gender }),
        ...(body.birthDate === undefined ? {} : { birthDate: body.birthDate }),
        ...(body.phone === undefined ? {} : { phone: body.phone }),
        ...(body.address === undefined ? {} : { address: body.address }),
        ...(body.guardianPhone === undefined ? {} : { guardianPhone: body.guardianPhone }),
        ...(body.major === undefined ? {} : { major: body.major })
      }
    })
  })

  return prisma.studentProfile.findUnique({ where: { userId: targetUserId } })
}
