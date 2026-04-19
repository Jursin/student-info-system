import { canManageTables } from '../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../utils/auth'
import { BASIC_INFO_TABLE_ID, deleteDynamicTableById } from '../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!canManageTables(user)) {
    throw createError({ statusCode: 403, message: '无权限删除表' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少表标识' })
  }

  if (id === BASIC_INFO_TABLE_ID) {
    throw createError({ statusCode: 400, message: '基本信息表不可删除' })
  }

  const ok = await deleteDynamicTableById(id)
  if (!ok) {
    throw createError({ statusCode: 404, message: '表不存在' })
  }

  await appendUserLog(user, 'delete', 'tables', `删除表 ${id}`)

  return { ok: true }
})
