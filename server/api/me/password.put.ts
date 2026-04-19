import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { hashPassword, isStrongPassword, verifyPassword } from '../../utils/security'
import { findUserByUserId, updateUserAuthState } from '../../utils/store'

interface PasswordBody {
  currentPassword: string
  newPassword: string
}

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<PasswordBody>(event)

  if (!body?.currentPassword || !body?.newPassword) {
    throw createError({ statusCode: 400, statusMessage: '请填写完整密码信息' })
  }

  if (!isStrongPassword(body.newPassword)) {
    throw createError({ statusCode: 400, statusMessage: '新密码至少10位，且包含大小写字母和数字' })
  }

  const account = await findUserByUserId(user.userId)
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: '账号不存在' })
  }

  if (!verifyPassword(body.currentPassword, account.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: '当前密码错误' })
  }

  await updateUserAuthState({
    userId: user.userId,
    passwordHash: hashPassword(body.newPassword)
  })

  await appendUserLog(user, 'update', 'password', '修改登录密码')

  return { ok: true }
})


