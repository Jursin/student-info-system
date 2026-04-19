import { canManageAllStudents } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { deleteStudentProfile } from '../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const userId = getRouterParam(event, 'studentId')

  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少用户名/学号参数' })
  }

  if (!canManageAllStudents(user)) {
    throw createError({ statusCode: 403, message: '只有管理员可删除学生' })
  }

  const removed = await deleteStudentProfile(userId)
  if (!removed) {
    throw createError({ statusCode: 404, message: '学生不存在' })
  }

  await appendUserLog(user, 'delete', 'students', `删除学生 ${userId}`)

  return { ok: true }
})
