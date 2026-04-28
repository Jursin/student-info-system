import * as otplib from 'otplib'
import { requireSessionUser } from '../../../utils/auth'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const secret = otplib.generateSecret()
  const otpauth = otplib.generateURI({
    issuer: '学生信息管理系统',
    label: user.userId,
    secret
  })

  return {
    secret,
    otpauth
  }
})
