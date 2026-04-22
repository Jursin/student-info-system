import { canManageAllStudents } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { hashPassword } from '../../utils/security'
import {
  BASIC_INFO_TABLE_ID,
  addStudentToDynamicTable,
  createStudentProfile,
  findDynamicTableById,
  getStudentProfileByUserId,
  isStudentProfileFieldKey,
  updateStudentRecord,
  upsertDynamicFieldValues
} from '../../utils/store'

interface CreateBody {
  tableId?: string
  userId: string
  name: string
  className?: string
  gender?: string
  values?: Record<string, unknown>
}

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!canManageAllStudents(user)) {
    throw createError({ statusCode: 403, message: '只有管理员可新增学生' })
  }

  const body = await readBody<CreateBody>(event)
  const tableId = body.tableId?.trim()
  const userId = body.userId?.trim()
  const name = body.name?.trim()
  const className = body.className?.trim()

  const table = tableId ? await findDynamicTableById(tableId) : null
  if (tableId && !table) {
    throw createError({ statusCode: 404, message: '目标信息表不存在' })
  }

  const isBasicInfoTarget = !tableId || tableId === BASIC_INFO_TABLE_ID
  const normalizedValues = Object.entries(body.values || {}).reduce((acc, [key, value]) => {
    acc[key] = String(value ?? '')
    return acc
  }, {} as Record<string, string>)

  if (!userId || !name) {
    throw createError({ statusCode: 400, message: '用户名/学号、姓名不能为空' })
  }

  const existing = await getStudentProfileByUserId(userId)
  if (existing && isBasicInfoTarget) {
    throw createError({ statusCode: 400, message: '用户名/学号已存在' })
  }

  let result
  if (!existing) {
    result = await createStudentProfile({
      userId: userId,
      name,
      className: isBasicInfoTarget ? className || '' : '',
      gender: body.gender || '',
      passwordHash: hashPassword('Stu1234567')
    })
  } else {
    result = await updateStudentRecord(userId, {
      gender: body.gender
    })
  }

  if (tableId && table?.type === 'partial' && table.id !== BASIC_INFO_TABLE_ID) {
    await addStudentToDynamicTable(table.id, userId)
    if (existing && existing.name !== name) {
      result = await getStudentProfileByUserId(userId)
    }
  }

  if (table && result) {
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
      userId: result.userId,
      values: dynamicValues
    })
  }

  await appendUserLog(user, 'create', 'students', `新增学生 ${userId}`)

  return result
    ? {
        userId: result.userId,
        name: result.name,
        className: result.className,
        gender: result.gender,
        passwordHash: result.passwordHash
      }
    : result
})
