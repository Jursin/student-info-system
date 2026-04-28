import * as otplib from 'otplib'
import { requireSessionUser } from '../../../utils/auth'
import { setTotpSecret } from '../../../utils/store'

interface VerifyBody {
  code: string
  secret: string
}

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<VerifyBody>(event)

  if (!body.code || !body.secret) {
    throw createError({ statusCode: 400, message: '缺少验证码或密钥' })
  }

  const result = await otplib.verify({ token: body.code, secret: body.secret })
  if (!result.valid) {
    throw createError({ statusCode: 400, message: '验证码错误' })
  }

  // Only save to DB after successful verification
  await setTotpSecret(user.userId, body.secret)

  return { success: true }
})
