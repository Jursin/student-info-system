import { pgTable, text, integer, timestamp, pgEnum, serial, jsonb, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const userRoleEnum = pgEnum('user_role', ['student', 'classLeader', 'admin', 'superAdmin'])
export const fieldTypeEnum = pgEnum('field_type', ['text', 'number', 'chinese', 'date', 'singleChoice'])
export const operationActionEnum = pgEnum('operation_action', ['create', 'read', 'update', 'delete', 'login', 'logout'])
export const tableTypeEnum = pgEnum('table_type', ['full', 'partial'])

export const userAccounts = pgTable('user_accounts', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  role: userRoleEnum('role').notNull(),
  passwordHash: text('password_hash').notNull(),
  failedAttempts: integer('failed_attempts').default(0).notNull(),
  lockUntil: timestamp('lock_until', { withTimezone: true })
})

export const userAccountsRelations = relations(userAccounts, ({ many }) => ({
  sessions: many(sessionTokens)
}))

export const studentProfiles = pgTable('student_profiles', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  gender: text('gender').notNull(),
  birthDate: text('birth_date').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  guardianPhone: text('guardian_phone').notNull(),
  major: text('major').notNull(),
  passwordHash: text('password_hash').notNull()
})

export const dynamicTables = pgTable('dynamic_tables', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdBy: text('created_by').notNull(),
  type: tableTypeEnum('type').default('partial').notNull()
})

export const dynamicTablesRelations = relations(dynamicTables, ({ many }) => ({
  fields: many(dynamicFields),
  rows: many(dynamicTableRows)
}))

export const dynamicFields = pgTable('dynamic_fields', {
  id: serial('id').primaryKey(),
  tableId: text('table_id').references(() => dynamicTables.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade'
  }).notNull(),
  key: text('key').notNull(),
  label: text('label').notNull(),
  type: fieldTypeEnum('type').notNull(),
  limit: integer('limit'),
  options: jsonb('options')
}, table => [
  index('dynamic_fields_table_id_idx').on(table.tableId)
])

export const dynamicFieldsRelations = relations(dynamicFields, ({ one }) => ({
  table: one(dynamicTables, {
    fields: [dynamicFields.tableId],
    references: [dynamicTables.id]
  })
}))

export const dynamicTableRows = pgTable('dynamic_table_rows', {
  id: serial('id').primaryKey(),
  tableId: text('table_id').references(() => dynamicTables.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade'
  }).notNull(),
  userId: text('user_id').notNull()
}, table => [
  unique('dynamic_table_rows_table_id_user_id_unique').on(table.tableId, table.userId),
  index('dynamic_table_rows_table_id_idx').on(table.tableId),
  index('dynamic_table_rows_user_id_idx').on(table.userId)
])

export const dynamicTableRowsRelations = relations(dynamicTableRows, ({ one }) => ({
  table: one(dynamicTables, {
    fields: [dynamicTableRows.tableId],
    references: [dynamicTables.id]
  })
}))

export const operationLogs = pgTable('operation_logs', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  operatorId: text('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  action: operationActionEnum('action').notNull(),
  target: text('target').notNull(),
  detail: text('detail').notNull()
}, table => [
  index('operation_logs_timestamp_idx').on(table.timestamp),
  index('operation_logs_action_idx').on(table.action)
])

export const sessionTokens = pgTable('session_tokens', {
  token: text('token').primaryKey(),
  userId: text('user_id').references(() => userAccounts.userId, {
    onDelete: 'cascade',
    onUpdate: 'cascade'
  }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [
  index('session_tokens_user_id_idx').on(table.userId),
  index('session_tokens_expires_at_idx').on(table.expiresAt)
])

export const sessionTokensRelations = relations(sessionTokens, ({ one }) => ({
  user: one(userAccounts, {
    fields: [sessionTokens.userId],
    references: [userAccounts.userId]
  })
}))
