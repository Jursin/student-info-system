import { canViewLogs } from '../../utils/access'
import { requireSessionUser } from '../../utils/auth'
import { listOperationLogs } from '../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!canViewLogs(user)) {
    throw createError({ statusCode: 403, statusMessage: '无权限查看日志' })
  }

  const query = getQuery(event)
  const action = typeof query.action === 'string' ? query.action : ''
  const target = typeof query.target === 'string' ? query.target : ''

  return listOperationLogs({ action, target })
})


