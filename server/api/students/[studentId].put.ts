import { canManageAllStudents } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { BASIC_INFO_TABLE_ID, getStudentProfileByUserId, updateStudentRecord } from '../../utils/store'

interface UpdateBody {
  tableId?: string
  userId?: string
  name?: string
  className?: string
  gender?: string
  birthDate?: string
  phone?: string
  address?: string
  guardianPhone?: string
  major?: string
}

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const canManage = canManageAllStudents(user)
  const userId = getRouterParam(event, 'studentId')

  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少用户名/学号参数' })
  }

  const body = await readBody<UpdateBody>(event)
  const profile = await getStudentProfileByUserId(userId)

  if (!profile) {
    throw createError({ statusCode: 404, message: '学生不存在' })
  }

  const isSelf = user.userId === userId
  if (!isSelf && !canManage) {
    throw createError({ statusCode: 403, message: '无权限修改该学生信息' })
  }

  const nextUserId = body.userId?.trim()
  const nextName = body.name?.trim()
  const nextClassName = body.className?.trim()

  if (body.userId !== undefined && !nextUserId) {
    throw createError({ statusCode: 400, message: '用户名/学号不能为空' })
  }

  if (body.name !== undefined && !nextName) {
    throw createError({ statusCode: 400, message: '姓名不能为空' })
  }

  const isCoreChanged = nextUserId !== undefined || nextName !== undefined || nextClassName !== undefined
  if (isCoreChanged && body.tableId !== BASIC_INFO_TABLE_ID) {
    throw createError({ statusCode: 400, message: '用户名/学号、姓名、班级仅允许在基本信息表修改' })
  }

  if (!canManage && body.tableId === BASIC_INFO_TABLE_ID && (nextUserId !== undefined || nextName !== undefined || nextClassName !== undefined)) {
    throw createError({ statusCode: 403, message: '学生不可修改学号、姓名、班级字段' })
  }

  if (body.phone && !/^\d{11}$/.test(body.phone)) {
    throw createError({ statusCode: 400, message: '手机号必须为11位数字' })
  }

  if (body.guardianPhone && !/^\d{11}$/.test(body.guardianPhone)) {
    throw createError({ statusCode: 400, message: '监护人手机号必须为11位数字' })
  }

  const updated = await updateStudentRecord(userId, {
    nextUserId,
    name: nextName,
    className: nextClassName,
    gender: body.gender,
    birthDate: body.birthDate,
    phone: body.phone,
    address: body.address,
    guardianPhone: body.guardianPhone,
    major: body.major
  })
  if (!updated) {
    throw createError({ statusCode: 404, message: '学生不存在' })
  }

  await appendUserLog(user, 'update', 'students', `更新学生 ${userId} 信息`)

  return {
    userId: updated.userId,
    name: updated.name,
    className: updated.className,
    gender: updated.gender,
    birthDate: updated.birthDate,
    phone: updated.phone,
    address: updated.address,
    guardianPhone: updated.guardianPhone,
    major: updated.major,
    passwordHash: updated.passwordHash
  }
})
