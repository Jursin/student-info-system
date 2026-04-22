import { hashPassword } from './security'
import { db } from './drizzle'
import * as schema from '../db/schema'
import { eq, and, ilike, not, inArray, desc, asc, count as drizzleCount, gte, lte } from 'drizzle-orm'

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
export const STUDENT_PROFILE_FIELD_KEYS = ['userId', 'name', 'className', 'gender'] as const

export function isStudentProfileFieldKey(key: string) {
  return STUDENT_PROFILE_FIELD_KEYS.includes(key as typeof STUDENT_PROFILE_FIELD_KEYS[number])
}

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
    const [row] = await db.select({ count: drizzleCount() }).from(schema.userAccounts)
    const count = Number(row?.count || 0)
    if (count > 0) {
      return
    }

    await db.transaction(async (tx) => {
      for (const user of seedUsers) {
        await tx.insert(schema.userAccounts).values({
          userId: user.userId,
          name: user.name,
          className: user.className,
          role: user.role,
          passwordHash: hashPassword(user.password),
          failedAttempts: 0,
          lockUntil: null
        })
      }

      for (const profile of seedProfiles) {
        await tx.insert(schema.studentProfiles).values({
          userId: profile.userId,
          name: profile.name,
          className: profile.className,
          gender: profile.gender,
          passwordHash: profile.passwordHash
        })
      }

      for (const table of seedTables) {
        await tx.insert(schema.dynamicTables).values({
          id: table.id,
          name: table.name,
          createdBy: table.createdBy,
          type: table.type
        })

        if (table.fields.length > 0) {
          await tx.insert(schema.dynamicFields).values(
            table.fields.map(field => ({
              tableId: table.id,
              key: field.key,
              label: field.label,
              type: field.type,
              limit: field.limit,
              options: field.options
            }))
          )
        }
      }
    })
  })()

  return seedPromise
}

export async function findUserByUserId(userId: string): Promise<UserAccount | null> {
  await ensureSeedData()

  const [user] = await db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, userId))
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

  const data: Partial<typeof schema.userAccounts.$inferInsert> = {}
  if (params.failedAttempts !== undefined) data.failedAttempts = params.failedAttempts
  if (params.lockUntil !== undefined) data.lockUntil = params.lockUntil
  if (params.passwordHash !== undefined) data.passwordHash = params.passwordHash

  if (Object.keys(data).length > 0) {
    await db.update(schema.userAccounts)
      .set(data)
      .where(eq(schema.userAccounts.userId, params.userId))
  }
}

export async function upsertSessionToken(params: {
  token: string
  userId: string
  expiresAt: Date
}): Promise<void> {
  await ensureSeedData()

  await db.insert(schema.sessionTokens)
    .values({
      token: params.token,
      userId: params.userId,
      expiresAt: params.expiresAt
    })
    .onConflictDoUpdate({
      target: schema.sessionTokens.token,
      set: {
        userId: params.userId,
        expiresAt: params.expiresAt
      }
    })
}

export async function deleteSessionToken(token: string): Promise<void> {
  await ensureSeedData()

  await db.delete(schema.sessionTokens).where(eq(schema.sessionTokens.token, token))
}

export async function findSessionUserByToken(token: string): Promise<UserAccount | null> {
  await ensureSeedData()

  const row = await db.select({
    session: schema.sessionTokens,
    user: schema.userAccounts
  })
    .from(schema.sessionTokens)
    .innerJoin(schema.userAccounts, eq(schema.sessionTokens.userId, schema.userAccounts.userId))
    .where(eq(schema.sessionTokens.token, token))
    .limit(1)
    .then(res => res[0])

  if (!row) {
    return null
  }

  const { session, user } = row

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.delete(schema.sessionTokens).where(eq(schema.sessionTokens.token, token))
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

export async function getStudentProfileByUserId(userId: string): Promise<StudentProfile | null> {
  await ensureSeedData()

  const [profile] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, userId))
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

  const filters = []
  if (params?.userId) filters.push(eq(schema.studentProfiles.userId, params.userId))
  if (params?.className) filters.push(eq(schema.studentProfiles.className, params.className))

  return db.select()
    .from(schema.studentProfiles)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(schema.studentProfiles.userId))
}

export async function createStudentProfile(profile: StudentProfile): Promise<StudentProfile> {
  await ensureSeedData()

  return db.transaction(async (tx) => {
    const [createdProfile] = await tx.insert(schema.studentProfiles).values({
      userId: profile.userId,
      name: profile.name,
      className: profile.className,
      gender: profile.gender,
      passwordHash: profile.passwordHash
    }).returning()
    if (!createdProfile) throw new Error('Failed to create student profile')

    const [account] = await tx.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, profile.userId))
    if (!account) {
      await tx.insert(schema.userAccounts).values({
        userId: profile.userId,
        name: profile.name,
        className: profile.className,
        role: 'student',
        passwordHash: profile.passwordHash,
        failedAttempts: 0,
        lockUntil: null
      })
    }

    return createdProfile
  })
}

export async function ensureStudentAccountByUserId(userId: string): Promise<UserAccount | null> {
  await ensureSeedData()

  const [exists] = await db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, userId))
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

  const [profile] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, userId))
  if (!profile) {
    return null
  }

  const [created] = await db.insert(schema.userAccounts).values({
    userId: profile.userId,
    name: profile.name,
    className: profile.className,
    role: 'student',
    passwordHash: profile.passwordHash,
    failedAttempts: 0,
    lockUntil: null
  }).returning()

  if (!created) throw new Error('Failed to create user account')

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

  const [exists] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, userId))
  if (!exists) {
    return null
  }

  const data: Partial<typeof schema.studentProfiles.$inferInsert> = {}
  if (body.gender !== undefined) data.gender = body.gender
  if (body.passwordHash !== undefined) data.passwordHash = body.passwordHash

  const [updated] = await db.update(schema.studentProfiles)
    .set(data)
    .where(eq(schema.studentProfiles.userId, userId))
    .returning()

  return updated || null
}

export async function deleteStudentProfile(userId: string): Promise<boolean> {
  await ensureSeedData()

  const result = await db.transaction(async (tx) => {
    await tx.delete(schema.dynamicFieldValues).where(eq(schema.dynamicFieldValues.userId, userId))
    await tx.delete(schema.dynamicTableRows).where(eq(schema.dynamicTableRows.userId, userId))
    const res = await tx.delete(schema.studentProfiles).where(eq(schema.studentProfiles.userId, userId))
    return res.rowCount ?? 0
  })

  return result > 0
}

export async function clearStudentProfiles(): Promise<void> {
  await ensureSeedData()
  await db.delete(schema.studentProfiles)
}

export async function listDynamicTables(): Promise<DynamicTable[]> {
  await ensureSeedData()

  const tables = await db.select().from(schema.dynamicTables).orderBy(asc(schema.dynamicTables.id))
  const allFields = await db.select().from(schema.dynamicFields).orderBy(asc(schema.dynamicFields.id))

  const fieldsByTableId = allFields.reduce((acc, field) => {
    const list = acc[field.tableId] || []
    list.push(field)
    acc[field.tableId] = list
    return acc
  }, {} as Record<string, (typeof allFields)[number][]>)

  return tables.map(table => ({
    id: table.id,
    name: table.name,
    createdBy: table.createdBy,
    type: toTableType(table.type),
    fields: (fieldsByTableId[table.id] || []).map(field => ({
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

  await db.transaction(async (tx) => {
    await tx.insert(schema.dynamicTables).values({
      id: params.id,
      name: params.name,
      createdBy: params.createdBy,
      type: params.type
    })

    if (params.fields.length > 0) {
      await tx.insert(schema.dynamicFields).values(
        params.fields.map(field => ({
          tableId: params.id,
          key: normalizeDynamicFieldKeyToDb(field.key),
          label: field.label,
          type: field.type,
          limit: field.limit,
          options: field.options
        }))
      )
    }
  })
}

export async function findDynamicTableById(id: string): Promise<DynamicTable | null> {
  await ensureSeedData()

  const [table] = await db.select().from(schema.dynamicTables).where(eq(schema.dynamicTables.id, id))
  if (!table) {
    return null
  }

  const fields = await db.select().from(schema.dynamicFields)
    .where(eq(schema.dynamicFields.tableId, id))
    .orderBy(asc(schema.dynamicFields.id))

  return {
    id: table.id,
    name: table.name,
    createdBy: table.createdBy,
    type: toTableType(table.type),
    fields: fields.map(field => ({
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

  const [exists] = await db.select().from(schema.dynamicTables).where(eq(schema.dynamicTables.id, id))
  if (!exists) {
    return null
  }

  await db.transaction(async (tx) => {
    const data: Partial<typeof schema.dynamicTables.$inferInsert> = {}
    if (params.name !== undefined) data.name = params.name
    if (params.type !== undefined) data.type = params.type

    if (Object.keys(data).length > 0) {
      await tx.update(schema.dynamicTables).set(data).where(eq(schema.dynamicTables.id, id))
    }

    if (params.fields !== undefined) {
      await tx.delete(schema.dynamicFields).where(eq(schema.dynamicFields.tableId, id))
      if (params.fields.length > 0) {
        await tx.insert(schema.dynamicFields).values(
          params.fields.map(field => ({
            tableId: id,
            key: normalizeDynamicFieldKeyToDb(field.key),
            label: field.label,
            type: field.type,
            limit: field.limit,
            options: field.options
          }))
        )
      }

      const fieldKeys = params.fields
        .map(field => normalizeDynamicFieldKeyToDb(field.key))
      if (fieldKeys.length > 0) {
        await tx.delete(schema.dynamicFieldValues)
          .where(and(
            eq(schema.dynamicFieldValues.tableId, id),
            not(inArray(schema.dynamicFieldValues.fieldKey, fieldKeys))
          ))
      } else {
        await tx.delete(schema.dynamicFieldValues)
          .where(eq(schema.dynamicFieldValues.tableId, id))
      }
    }
  })

  return findDynamicTableById(id)
}

export async function deleteDynamicTableById(id: string): Promise<boolean> {
  await ensureSeedData()

  const deleted = await db.transaction(async (tx) => {
    await tx.delete(schema.dynamicFieldValues).where(eq(schema.dynamicFieldValues.tableId, id))
    await tx.delete(schema.dynamicTableRows).where(eq(schema.dynamicTableRows.tableId, id))
    await tx.delete(schema.dynamicFields).where(eq(schema.dynamicFields.tableId, id))
    const result = await tx.delete(schema.dynamicTables).where(eq(schema.dynamicTables.id, id))
    return result.rowCount ?? 0
  })

  return deleted > 0
}

export async function listDynamicTableUserIds(tableId: string): Promise<string[]> {
  await ensureSeedData()

  const rows = await db.select({ userId: schema.dynamicTableRows.userId })
    .from(schema.dynamicTableRows)
    .where(eq(schema.dynamicTableRows.tableId, tableId))
    .orderBy(asc(schema.dynamicTableRows.id))

  return rows.map(row => row.userId)
}

export async function addStudentToDynamicTable(tableId: string, userId: string): Promise<void> {
  await ensureSeedData()

  await db.insert(schema.dynamicTableRows)
    .values({
      tableId,
      userId
    })
    .onConflictDoNothing({
      target: [schema.dynamicTableRows.tableId, schema.dynamicTableRows.userId]
    })
}

export async function listDynamicFieldValuesByTable(tableId: string, userIds?: string[]): Promise<Record<string, Record<string, string>>> {
  await ensureSeedData()

  const filters = [eq(schema.dynamicFieldValues.tableId, tableId)]
  if (userIds?.length) {
    filters.push(inArray(schema.dynamicFieldValues.userId, userIds))
  }

  const rows = await db.select({
    userId: schema.dynamicFieldValues.userId,
    fieldKey: schema.dynamicFieldValues.fieldKey,
    value: schema.dynamicFieldValues.value
  })
    .from(schema.dynamicFieldValues)
    .where(and(...filters))

  return rows.reduce((acc, item) => {
    const current = acc[item.userId] || {}
    current[item.fieldKey] = item.value
    acc[item.userId] = current
    return acc
  }, {} as Record<string, Record<string, string>>)
}

export async function upsertDynamicFieldValues(params: {
  tableId: string
  userId: string
  values: Record<string, string>
}): Promise<void> {
  await ensureSeedData()

  const entries = Object.entries(params.values)
  await db.transaction(async (tx) => {
    await tx.delete(schema.dynamicFieldValues)
      .where(and(
        eq(schema.dynamicFieldValues.tableId, params.tableId),
        eq(schema.dynamicFieldValues.userId, params.userId)
      ))

    if (!entries.length) {
      return
    }

    await tx.insert(schema.dynamicFieldValues)
      .values(entries.map(([fieldKey, value]) => ({
        tableId: params.tableId,
        userId: params.userId,
        fieldKey,
        value
      })))
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

  await db.insert(schema.operationLogs).values({
    operatorId: params.operatorId,
    operatorName: params.operatorName,
    action: params.action,
    target: params.target,
    detail: params.detail
  })
}

export async function listOperationLogs(params?: {
  action?: string
  target?: string
  keyword?: string
  includeRead?: boolean
}): Promise<OperationLog[]> {
  await ensureSeedData()

  const filters = []
  if (params?.action) filters.push(eq(schema.operationLogs.action, params.action as typeof schema.operationActionEnum.enumValues[number]))
  if (params?.target) filters.push(ilike(schema.operationLogs.target, `%${params.target}%`))
  if (!params?.includeRead) filters.push(not(eq(schema.operationLogs.action, 'read')))

  const logs = await db.select()
    .from(schema.operationLogs)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.operationLogs.timestamp))

  const operatorIds = [...new Set(logs.map(log => log.operatorId))]
  const operators = operatorIds.length
    ? await db.select({ userId: schema.userAccounts.userId, role: schema.userAccounts.role })
        .from(schema.userAccounts)
        .where(inArray(schema.userAccounts.userId, operatorIds))
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

function toOperationAction(action: string): OperationLog['action'] {
  return action as OperationLog['action']
}

export async function clearOperationLogs(params?: {
  startAt?: Date
  endAt?: Date
}): Promise<number> {
  await ensureSeedData()

  const filters = []
  if (params?.startAt) filters.push(gte(schema.operationLogs.timestamp, params.startAt))
  if (params?.endAt) filters.push(lte(schema.operationLogs.timestamp, params.endAt))

  const result = await db.delete(schema.operationLogs)
    .where(filters.length > 0 ? and(...filters) : undefined)

  return result.rowCount ?? 0
}

export async function listUserAccounts(params?: {
  roles?: UserRole[]
}): Promise<UserAccount[]> {
  await ensureSeedData()

  const filters = []
  if (params?.roles?.length) filters.push(inArray(schema.userAccounts.role, params.roles as (typeof schema.userRoleEnum.enumValues[number])[]))

  const users = await db.select()
    .from(schema.userAccounts)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(schema.userAccounts.userId))

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

  const [row] = await db.select({ count: drizzleCount() })
    .from(schema.userAccounts)
    .where(inArray(schema.userAccounts.role, ['superAdmin', 'admin', 'classLeader']))

  return Number(row?.count || 0)
}

export async function createUserAccount(params: {
  userId: string
  name: string
  className: string
  role: UserRole
  password: string
}): Promise<UserAccount> {
  await ensureSeedData()

  const [created] = await db.insert(schema.userAccounts).values({
    userId: params.userId,
    name: params.name,
    className: params.className,
    role: params.role,
    passwordHash: hashPassword(params.password),
    failedAttempts: 0,
    lockUntil: null
  }).returning()

  if (!created) throw new Error('Failed to create user account')

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

  const [current] = await db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, userId))
  if (!current) {
    return null
  }

  const nextUserId = params.nextUserId?.trim() || userId
  if (nextUserId !== userId) {
    const [exists] = await db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, nextUserId))
    if (exists) {
      throw createError({ statusCode: 400, message: '用户名或学号已存在' })
    }
  }

  await db.transaction(async (tx) => {
    const data: Partial<typeof schema.userAccounts.$inferInsert> = {
      userId: nextUserId,
      failedAttempts: 0,
      lockUntil: null
    }
    if (params.name !== undefined) data.name = params.name
    if (params.className !== undefined) data.className = params.className
    if (params.role !== undefined) data.role = params.role
    if (params.password !== undefined) data.passwordHash = hashPassword(params.password)

    await tx.update(schema.userAccounts)
      .set(data)
      .where(eq(schema.userAccounts.userId, userId))

    if (nextUserId !== userId) {
      await tx.update(schema.sessionTokens)
        .set({ userId: nextUserId })
        .where(eq(schema.sessionTokens.userId, userId))
    }
  })

  const [updated] = await db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, nextUserId))
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

  const result = await db.transaction(async (tx) => {
    await tx.delete(schema.sessionTokens).where(eq(schema.sessionTokens.userId, userId))
    const res = await tx.delete(schema.userAccounts).where(eq(schema.userAccounts.userId, userId))
    return res.rowCount ?? 0
  })

  return result > 0
}

export async function updateStudentRecord(userId: string, body: {
  nextUserId?: string
  name?: string
  className?: string
  gender?: string
}): Promise<StudentProfile | null> {
  await ensureSeedData()

  const [profile] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, userId))
  if (!profile) {
    return null
  }

  const [account] = await db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, userId))
  const targetUserId = body.nextUserId?.trim() || userId

  if (targetUserId !== userId) {
    const [exists] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, targetUserId))
    if (exists) {
      throw createError({ statusCode: 400, message: '学号已存在' })
    }

    const [accountExists] = await db.select().from(schema.userAccounts).where(eq(schema.userAccounts.userId, targetUserId))
    if (accountExists) {
      throw createError({ statusCode: 400, message: '学号已存在' })
    }
  }

  await db.transaction(async (tx) => {
    if (account) {
      if (targetUserId !== userId) {
        await tx.insert(schema.userAccounts)
          .values({
            userId: targetUserId,
            name: body.name !== undefined ? body.name : account.name,
            className: body.className !== undefined ? body.className : account.className,
            role: account.role,
            passwordHash: account.passwordHash,
            failedAttempts: account.failedAttempts,
            lockUntil: account.lockUntil
          })
      } else {
        const accountData: Partial<typeof schema.userAccounts.$inferInsert> = {}
        if (body.name !== undefined) accountData.name = body.name
        if (body.className !== undefined) accountData.className = body.className

        if (Object.keys(accountData).length > 0) {
          await tx.update(schema.userAccounts)
            .set(accountData)
            .where(eq(schema.userAccounts.userId, userId))
        }
      }
    }

    if (targetUserId !== userId) {
      await tx.update(schema.sessionTokens)
        .set({ userId: targetUserId })
        .where(eq(schema.sessionTokens.userId, userId))

      await tx.update(schema.dynamicTableRows)
        .set({ userId: targetUserId })
        .where(eq(schema.dynamicTableRows.userId, userId))

      await tx.update(schema.dynamicFieldValues)
        .set({ userId: targetUserId })
        .where(eq(schema.dynamicFieldValues.userId, userId))
    }

    const profileData: Partial<typeof schema.studentProfiles.$inferInsert> = {
      userId: targetUserId
    }
    if (body.name !== undefined) profileData.name = body.name
    if (body.className !== undefined) profileData.className = body.className
    if (body.gender !== undefined) profileData.gender = body.gender

    await tx.update(schema.studentProfiles)
      .set(profileData)
      .where(eq(schema.studentProfiles.userId, userId))

    if (account && targetUserId !== userId) {
      await tx.delete(schema.userAccounts)
        .where(eq(schema.userAccounts.userId, userId))
    }
  })

  const [updated] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, targetUserId))
  return updated || null
}
