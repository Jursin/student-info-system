import { randomBytes, scryptSync } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../utils/drizzle'
import * as schema from './schema'

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${digest}`
}

async function main() {
  const users = [
    {
      userId: 'superadmin',
      name: '超级管理员',
      className: '',
      role: 'superAdmin' as const,
      passwordHash: hashPassword('SuAdmin123')
    }
  ]

  const profiles: (typeof schema.studentProfiles.$inferInsert)[] = []

  const dynamicTables = [
    {
      id: 'basic-info',
      name: '基本信息',
      createdBy: 'system',
      type: 'full' as const,
      fields: [
        { key: 'userId', label: '学号', type: 'number' as const },
        { key: 'name', label: '姓名', type: 'chinese' as const },
        { key: 'gender', label: '性别', type: 'singleChoice' as const, options: ['男', '女'] },
        { key: 'className', label: '班级', type: 'text' as const }
      ]
    }
  ]

  for (const user of users) {
    await db.insert(schema.userAccounts)
      .values({
        userId: user.userId,
        name: user.name,
        className: user.className,
        role: user.role,
        passwordHash: user.passwordHash,
        failedAttempts: 0,
        lockUntil: null
      })
      .onConflictDoUpdate({
        target: schema.userAccounts.userId,
        set: {
          name: user.name,
          className: user.className,
          role: user.role,
          passwordHash: user.passwordHash,
          failedAttempts: 0,
          lockUntil: null
        }
      })
  }

  for (const profile of profiles) {
    await db.insert(schema.studentProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: schema.studentProfiles.userId,
        set: profile
      })
  }

  for (const table of dynamicTables) {
    await db.transaction(async (tx) => {
      await tx.insert(schema.dynamicTables)
        .values({
          id: table.id,
          name: table.name,
          createdBy: table.createdBy,
          type: table.type
        })
        .onConflictDoUpdate({
          target: schema.dynamicTables.id,
          set: {
            name: table.name,
            createdBy: table.createdBy,
            type: table.type
          }
        })

      await tx.delete(schema.dynamicFields).where(eq(schema.dynamicFields.tableId, table.id))

      if (table.fields.length > 0) {
        await tx.insert(schema.dynamicFields)
          .values(table.fields.map(f => ({
            tableId: table.id,
            key: f.key,
            label: f.label,
            type: f.type,
            options: f.options
          })))
      }
    })
  }

  console.log('Drizzle seed completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    // Pool will be closed when the process exits
  })
