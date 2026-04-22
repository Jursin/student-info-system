import { canManageAllStudents } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import {
  BASIC_INFO_TABLE_ID,
  findDynamicTableById,
  getStudentProfileByUserId,
  isStudentProfileFieldKey,
  updateStudentRecord,
  upsertDynamicFieldValues
} from '../../utils/store'

interface UpdateBody {
  tableId?: string
  userId?: string
  name?: string
  className?: string
  gender?: string
  values?: Record<string, unknown>
}

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const canManage = canManageAllStudents(user)
  const userId = getRouterParam(event, 'studentId')

  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少用户名/学号参数' })
  }

  const body = await readBody<UpdateBody>(event)
  const tableId = body.tableId?.trim()
  const table = tableId ? await findDynamicTableById(tableId) : null

  if (tableId && !table) {
    throw createError({ statusCode: 404, message: '目标信息表不存在' })
  }

  const profile = await getStudentProfileByUserId(userId)

  if (!profile) {
    throw createError({ statusCode: 404, message: '学生不存在' })
  }

  const isSelf = user.userId === userId
  if (!isSelf && !canManage) {
    throw createError({ statusCode: 403, message: '无权限修改该学生信息' })
  }

  const normalizedValues = Object.entries(body.values || {}).reduce((acc, [key, value]) => {
    acc[key] = String(value ?? '')
    return acc
  }, {} as Record<string, string>)

  const nextUserId = body.userId?.trim() ?? normalizedValues.userId?.trim()
  const nextName = body.name?.trim() ?? normalizedValues.name?.trim()
  const nextClassName = body.className?.trim() ?? normalizedValues.className?.trim()

  if (body.userId !== undefined && !nextUserId) {
    throw createError({ statusCode: 400, message: '用户名/学号不能为空' })
  }

  if (body.name !== undefined && !nextName) {
    throw createError({ statusCode: 400, message: '姓名不能为空' })
  }

  const isCoreChanged = nextUserId !== undefined || nextName !== undefined || nextClassName !== undefined
  if (isCoreChanged && tableId !== BASIC_INFO_TABLE_ID) {
    throw createError({ statusCode: 400, message: '用户名/学号、姓名、班级仅允许在基本信息表修改' })
  }

  if (!canManage && tableId === BASIC_INFO_TABLE_ID && (nextUserId !== undefined || nextName !== undefined || nextClassName !== undefined)) {
    throw createError({ statusCode: 403, message: '学生不可修改学号、姓名、班级字段' })
  }

  const updated = await updateStudentRecord(userId, {
    nextUserId,
    name: nextName,
    className: nextClassName,
    gender: body.gender
  })
  if (!updated) {
    throw createError({ statusCode: 404, message: '学生不存在' })
  }

  if (table) {
    const dynamicValues = table.fields.reduce((acc, field) => {
      if (isStudentProfileFieldKey(field.key)) {
        return acc
      }

      if (Object.prototype.hasOwnProperty.call(normalizedValues, field.key)) {
        acc[field.key] = String(normalizedValues[field.key] ?? '')
      }

      return acc
    }, {} as Record<string, string>)

    await upsertDynamicFieldValues({
      tableId: table.id,
      userId: updated.userId,
      values: dynamicValues
    })
  }

  await appendUserLog(user, 'update', 'students', `更新学生 ${userId} 信息`)

  return {
    userId: updated.userId,
    name: updated.name,
    className: updated.className,
    gender: updated.gender,
    passwordHash: updated.passwordHash
  }
})
