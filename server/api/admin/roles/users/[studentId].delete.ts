import { isSuperAdmin } from '../../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../../utils/auth'
import { deleteUserAccountByUserId, findUserByUserId } from '../../../../utils/store'

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
    throw createError({ statusCode: 400, message: '超级管理员不允许在此删除' })
  }

  const ok = await deleteUserAccountByUserId(userId)
  if (!ok) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  await appendUserLog(user, 'delete', 'roles', `删除角色用户 ${userId}`)

  return { ok: true }
})
