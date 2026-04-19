import { isSuperAdmin } from '../../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../../utils/auth'
import { deleteUserAccountByUserId, findUserByUserId } from '../../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!isSuperAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: '无权限管理角色' })
  }

  const userId = getRouterParam(event, 'studentId')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: '缺少用户名/学号参数' })
  }

  const current = await findUserByUserId(userId)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  if (current.role === 'superAdmin') {
    throw createError({ statusCode: 400, statusMessage: '超级管理员不允许在此删除' })
  }

  const ok = await deleteUserAccountByUserId(userId)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  await appendUserLog(user, 'delete', 'roles', `删除角色用户 ${userId}`)

  return { ok: true }
})
