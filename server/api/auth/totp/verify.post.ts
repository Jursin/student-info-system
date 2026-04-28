import * as otplib from 'otplib'
import { randomUUID } from 'crypto'
import { consumePendingTotpToken, getTotpSecret, upsertSessionToken, findUserByUserId } from '../../../utils/store'
import { setSessionCookie, appendUserLog } from '../../../utils/auth'

interface TotpVerifyBody {
  totpToken: string
  code: string
}

export default eventHandler(async (event) => {
  const body = await readBody<TotpVerifyBody>(event)

  if (!body.totpToken || !body.code) {
    throw createError({ statusCode: 400, message: '缺少验证信息' })
  }

  const userId = await consumePendingTotpToken(body.totpToken)
  if (!userId) {
    throw createError({ statusCode: 400, message: '验证会话已过期或无效，请重新登录' })
  }

  const secret = await getTotpSecret(userId)
  if (!secret) {
    throw createError({ statusCode: 400, message: '未配置两步验证' })
  }

  const result = await otplib.verify({ token: body.code, secret })
  if (!result.valid) {
    throw createError({ statusCode: 401, message: '验证码错误' })
  }

  const user = await findUserByUserId(userId)
  if (!user) {
    throw createError({ statusCode: 401, message: '用户账号不存在' })
  }

  const token = randomUUID()
  await upsertSessionToken({
    token,
    userId: user.userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 24 * 1000)
  })

  setSessionCookie(event, token, true)

  await appendUserLog(user, 'login', 'auth-totp', '两步验证登录系统')

  return {
    user: {
      userId: user.userId,
      name: user.name,
      className: user.className,
      role: user.role
    }
  }
})
