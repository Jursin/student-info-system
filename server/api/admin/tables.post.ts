import { canManageTables } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { createDynamicTable, findDynamicTableById, type DynamicField, type TableType } from '../../utils/store'

interface CreateTableBody {
  name: string
  tableType?: TableType
  fields: DynamicField[]
}

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!canManageTables(user)) {
    throw createError({ statusCode: 403, statusMessage: '无权限创建表' })
  }

  const body = await readBody<CreateTableBody>(event)
  const name = body?.name?.trim()

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '表名不能为空' })
  }

  const id = name.toLowerCase().replace(/\s+/g, '-')
  const existing = await findDynamicTableById(id)
  if (existing) {
    throw createError({ statusCode: 400, statusMessage: '表已存在' })
  }

  const tableType = body.tableType === 'full' ? 'full' : 'partial'

  const fields: DynamicField[] = body.fields || []

  await createDynamicTable({
    id,
    name,
    createdBy: user.userId,
    type: tableType,
    fields
  })

  await appendUserLog(user, 'create', 'tables', `创建表 ${name}`)

  return { ok: true }
})


