import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomBytes, scryptSync } from 'crypto'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL 未配置')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function hashPassword(password) {
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
      role: 'superAdmin',
      passwordHash: hashPassword('SuAdmin123')
    }
  ]

  const profiles = []

  const dynamicTables = [
    {
      id: 'basic-info',
      name: '基本信息',
      createdBy: 'system',
      fields: [
        { key: 'userId', label: '学号', type: 'number' },
        { key: 'name', label: '姓名', type: 'chinese' },
        { key: 'gender', label: '性别', type: 'singleChoice', options: ['男', '女'] },
        { key: 'className', label: '班级', type: 'text' }
      ]
    }
  ]

  for (const user of users) {
    await prisma.userAccount.upsert({
      where: { userId: user.userId },
      update: {
        name: user.name,
        className: user.className,
        role: user.role,
        passwordHash: user.passwordHash,
        failedAttempts: 0,
        lockUntil: null
      },
      create: {
        userId: user.userId,
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
    await prisma.studentProfile.upsert({
      where: { userId: profile.userId },
      update: profile,
      create: profile
    })
  }

  for (const table of dynamicTables) {
    await prisma.dynamicTable.upsert({
      where: { id: table.id },
      update: {
        name: table.name,
        createdBy: table.createdBy,
        fields: {
          deleteMany: {},
          create: table.fields
        }
      },
      create: {
        id: table.id,
        name: table.name,
        createdBy: table.createdBy,
        fields: {
          create: table.fields
        }
      }
    })
  }

  console.log('Prisma seed completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
