import { appendUserLog, requireSessionUser } from '../../../utils/auth'
import { listUserAccounts } from '../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (user.role !== 'admin' && user.role !== 'superAdmin') {
    throw createError({ statusCode: 403, message: '无权限查看角色管理' })
  }

  const users = await listUserAccounts({
    roles: ['superAdmin', 'admin', 'classLeader']
  })

  await appendUserLog(user, 'read', 'roles', '查看角色管理列表')

  return users.map(item => ({
    userId: item.userId,
    name: item.name,
    className: item.className,
    role: item.role
  }))
})
