import { randomUUID } from 'crypto'
import { appendUserLog } from '../../utils/auth'
import { isStrongPassword, verifyPassword } from '../../utils/security'
import { findUserByUserId, updateUserAuthState, upsertSessionToken } from '../../utils/store'

interface LoginBody {
  userId: string
  password: string
  remember?: boolean
}

export default eventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)
  const userId = body?.userId?.trim()
  const password = body?.password?.trim()
  const remember = !!body?.remember

  if (!userId || !password) {
    throw createError({ statusCode: 400, message: '请输入用户名/学号和密码' })
  }

  const user = await findUserByUserId(userId)
  if (!user || (user.role !== 'admin' && user.role !== 'superAdmin')) {
    throw createError({ statusCode: 401, message: '账号或密码错误' })
  }

  if (!isStrongPassword(password)) {
    throw createError({ statusCode: 400, message: '密码格式不符合策略' })
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw createError({ statusCode: 423, message: '密码错误次数过多，账号已锁定5分钟' })
  }

  const ok = verifyPassword(password, user.passwordHash)
  if (!ok) {
    const nextAttempts = user.failedAttempts + 1
    const lockUntil = nextAttempts >= 10 ? new Date(Date.now() + 5 * 60 * 1000) : user.lockUntil
    const failedAttempts = nextAttempts >= 10 ? 0 : nextAttempts

    await updateUserAuthState({
      userId: user.userId,
      failedAttempts,
      lockUntil
    })

    throw createError({ statusCode: 401, message: '账号或密码错误' })
  }

  await updateUserAuthState({
    userId: user.userId,
    failedAttempts: 0,
    lockUntil: null
  })

  const token = randomUUID()
  await upsertSessionToken({
    token,
    userId: user.userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 24 * 1000)
  })

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/'
  }

  if (remember) {
    setCookie(event, 'sis_session', token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24
    })
  } else {
    setCookie(event, 'sis_session', token, cookieOptions)
  }

  await appendUserLog(user, 'login', 'auth-admin', '管理员登录系统')

  return {
    user: {
      userId: user.userId,
      name: user.name,
      className: user.className,
      role: user.role
    }
  }
})
