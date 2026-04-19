import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { isSuperAdmin } from '../../utils/access'
import { clearStudentProfiles } from '../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!isSuperAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: '仅超级管理员可清空数据' })
  }

  await clearStudentProfiles()

  await appendUserLog(user, 'delete', 'students', '清空学生表数据')

  return { ok: true }
})


