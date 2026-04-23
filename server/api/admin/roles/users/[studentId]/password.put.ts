import { isSuperAdmin } from '../../../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../../../utils/auth'
import { getAdminDefaultPassword, getStudentDefaultPassword } from '../../../../../utils/password-config'
import { hashPassword } from '../../../../../utils/security'
import { findUserByUserId, updateUserAuthState } from '../../../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (user.role !== 'admin' && !isSuperAdmin(user)) {
    throw createError({ statusCode: 403, message: '无权限管理角色' })
  }

  const userId = getRouterParam(event, 'studentId')
  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少用户名/学号参数' })
  }

  const current = await findUserByUserId(userId)
  if (!current) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  if (user.role === 'admin' && current.role === 'admin' && current.userId !== user.userId) {
    throw createError({ statusCode: 403, message: '管理员不可修改其它管理员信息' })
  }

  if (current.role === 'superAdmin') {
    throw createError({ statusCode: 400, message: '不支持重置超级管理员密码' })
  }

  const defaultPassword = current.role === 'admin'
    ? getAdminDefaultPassword()
    : getStudentDefaultPassword()

  await updateUserAuthState({
    userId,
    passwordHash: hashPassword(defaultPassword)
  })

  await appendUserLog(user, 'update', 'roles', `重置角色用户 ${userId} 的密码为默认值`)

  return { success: true }
})
