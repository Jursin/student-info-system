import { eq } from 'drizzle-orm'
import { db } from '../utils/drizzle'
import { hashPassword } from '../utils/security'
import { getBootstrapSuperAdminPassword } from '../utils/password-config'
import * as schema from './schema'

async function main() {
  const args = process.argv.slice(2)
  const userId = args[0] || 'superadmin'
  const newPassword = args[1] || getBootstrapSuperAdminPassword()

  console.log(`正在重置超级管理员 "${userId}" 的密码、TOTP和通行密钥...`)

  try {
    // 检查用户是否存在且是超级管理员
    const user = await db.select()
      .from(schema.userAccounts)
      .where(eq(schema.userAccounts.userId, userId))

    if (!user || user.length === 0) {
      console.error(`❌ 错误：用户 "${userId}" 不存在`)
      process.exit(1)
    }

    const targetUser = user[0]!
    if (targetUser.role !== 'superAdmin') {
      console.error(`❌ 错误：用户 "${userId}" 不是超级管理员`)
      process.exit(1)
    }

    // 在事务中执行所有操作
    await db.transaction(async (tx) => {
      // 重置密码
      await tx.update(schema.userAccounts)
        .set({
          passwordHash: hashPassword(newPassword),
          failedAttempts: 0,
          lockUntil: null
        })
        .where(eq(schema.userAccounts.userId, userId))

      // 删除 TOTP
      await tx.delete(schema.totpSecrets)
        .where(eq(schema.totpSecrets.userId, userId))

      // 删除所有通行密钥
      await tx.delete(schema.passkeyCredentials)
        .where(eq(schema.passkeyCredentials.userId, userId))
    })

    console.log(`✅ 成功重置超级管理员 "${userId}" 的密码、TOTP和通行密钥`)
    console.log(`💡 新密码为：${newPassword}`)
  } catch (error) {
    console.error('❌ 重置失败：', error)
    process.exit(1)
  }
}

main()
