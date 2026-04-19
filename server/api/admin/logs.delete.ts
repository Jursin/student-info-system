import { canViewLogs } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { clearOperationLogs } from '../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!canViewLogs(user)) {
    throw createError({ statusCode: 403, message: '无权限清除日志' })
  }

  const body = await readBody<{ startAt?: string, endAt?: string }>(event)

  const startAt = body?.startAt ? new Date(body.startAt) : undefined
  const endAt = body?.endAt ? new Date(body.endAt) : undefined

  if (startAt && Number.isNaN(startAt.getTime())) {
    throw createError({ statusCode: 400, message: '开始时间格式无效' })
  }

  if (endAt && Number.isNaN(endAt.getTime())) {
    throw createError({ statusCode: 400, message: '结束时间格式无效' })
  }

  if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
    throw createError({ statusCode: 400, message: '开始时间不能晚于结束时间' })
  }

  const deletedCount = await clearOperationLogs({ startAt, endAt })

  await appendUserLog(
    user,
    'delete',
    'logs',
    startAt || endAt
      ? `按时间范围清除日志，共 ${deletedCount} 条`
      : `清除全部日志，共 ${deletedCount} 条`
  )

  return {
    deletedCount
  }
})
