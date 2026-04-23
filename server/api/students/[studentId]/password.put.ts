import { canManageAllStudents } from '../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../utils/auth'
import { getStudentDefaultPassword } from '../../../utils/password-config'
import { hashPassword } from '../../../utils/security'
import { getStudentProfileByUserId, updateStudentProfile } from '../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const userId = getRouterParam(event, 'studentId')

  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少用户名/学号参数' })
  }

  // 只有管理员可以重置学生密码
  if (!canManageAllStudents(user)) {
    throw createError({ statusCode: 403, message: '只有管理员可重置学生密码' })
  }

  const profile = await getStudentProfileByUserId(userId)
  if (!profile) {
    throw createError({ statusCode: 404, message: '学生不存在' })
  }

  const defaultStudentPassword = getStudentDefaultPassword()

  const updated = await updateStudentProfile(userId, {
    passwordHash: hashPassword(defaultStudentPassword)
  })

  if (!updated) {
    throw createError({ statusCode: 404, message: '学生不存在' })
  }

  await appendUserLog(user, 'update', 'students', `重置学生 ${userId} 的密码`)

  return { success: true }
})
