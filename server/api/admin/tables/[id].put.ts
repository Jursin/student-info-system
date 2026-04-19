import { canManageTables } from '../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../utils/auth'
import {
  BASIC_INFO_LOCKED_FIELDS,
  BASIC_INFO_TABLE_ID,
  findDynamicTableById,
  updateDynamicTableById,
  type DynamicField
} from '../../../utils/store'

interface UpdateTableBody {
  name?: string
  fields?: DynamicField[]
}

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!canManageTables(user)) {
    throw createError({ statusCode: 403, message: '无权限修改表' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少表标识' })
  }

  const body = await readBody<UpdateTableBody>(event)
  const current = await findDynamicTableById(id)
  if (!current) {
    throw createError({ statusCode: 404, message: '表不存在' })
  }

  const nextName = body.name?.trim()
  if (body.name !== undefined && !nextName) {
    throw createError({ statusCode: 400, message: '表名不能为空' })
  }

  if (id === BASIC_INFO_TABLE_ID && body.name !== undefined && nextName !== current.name) {
    throw createError({ statusCode: 400, message: '基本信息表不允许重命名' })
  }

  const fields = body.fields
    ? (id === BASIC_INFO_TABLE_ID
        ? (() => {
            const lockedMap = new Map(BASIC_INFO_LOCKED_FIELDS.map(field => [field.key, field] as const))
            const lockedKeys = new Set(BASIC_INFO_LOCKED_FIELDS.map(field => field.key))
            const seenLockedKeys = new Set<string>()
            const nextFields: DynamicField[] = []

            for (const field of body.fields) {
              const lockedField = lockedMap.get(field.key)
              if (lockedField) {
                nextFields.push(lockedField)
                seenLockedKeys.add(field.key)
                continue
              }

              nextFields.push(field)
            }

            for (const lockedField of BASIC_INFO_LOCKED_FIELDS) {
              if (!seenLockedKeys.has(lockedField.key) && lockedKeys.has(lockedField.key)) {
                nextFields.push(lockedField)
              }
            }

            return nextFields
          })()
        : body.fields)
    : undefined

  const updated = await updateDynamicTableById(id, {
    name: nextName,
    fields
  })

  if (!updated) {
    throw createError({ statusCode: 404, message: '表不存在' })
  }

  await appendUserLog(user, 'update', 'tables', `修改表 ${current.name}`)

  return updated
})
