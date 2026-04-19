import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { BASIC_INFO_TABLE_ID, listDynamicTableUserIds, listDynamicTables, listStudentProfiles } from '../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const tableId = getRouterParam(event, 'id')

  if (!tableId) {
    throw createError({ statusCode: 400, statusMessage: '缺少表标识' })
  }

  const tables = await listDynamicTables()
  const table = tables.find(item => item.id === tableId)

  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '表不存在' })
  }

  let profiles = await listStudentProfiles()
  if (table.type === 'partial' && table.id !== BASIC_INFO_TABLE_ID) {
    const userIds = await listDynamicTableUserIds(table.id)
    const userIdSet = new Set(userIds)
    profiles = profiles.filter(item => userIdSet.has(item.userId))
  }

  if (user.role === 'student') {
    profiles = profiles.filter(item => item.userId === user.userId)
  } else if (user.role === 'classLeader') {
    profiles = profiles.filter(item => item.className === user.className)
  }

  const rows = profiles.map((profile) => {
    const record: Record<string, string> = {}
    const profileRecord = profile as unknown as Record<string, unknown>

    for (const field of table.fields) {
      const value = field.key === 'userId'
        ? profile.userId
        : profileRecord[field.key]
      record[field.key] = value === undefined || value === null ? '' : String(value)
    }

    return record
  })

  await appendUserLog(user, 'read', `tables:${table.id}`, `查看表 ${table.name} 详情`)

  return {
    table,
    rows
  }
})
