import { canManageAllStudents } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { hashPassword } from '../../utils/security'
import {
  BASIC_INFO_TABLE_ID,
  addStudentToDynamicTable,
  createStudentProfile,
  findDynamicTableById,
  getStudentProfileByUserId,
  updateStudentRecord
} from '../../utils/store'

interface CreateBody {
  tableId?: string
  userId: string
  name: string
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

  if (!userId || !name) {
    throw createError({ statusCode: 400, message: '用户名/学号、姓名不能为空' })
  }

  if (body.phone && !/^\d{11}$/.test(body.phone)) {
    throw createError({ statusCode: 400, message: '手机号必须为11位数字' })
  }

  if (body.guardianPhone && !/^\d{11}$/.test(body.guardianPhone)) {
    throw createError({ statusCode: 400, message: '监护人手机号必须为11位数字' })
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
      birthDate: body.birthDate || '',
      phone: body.phone || '',
      address: body.address || '',
      guardianPhone: body.guardianPhone || '',
      major: body.major || '',
      passwordHash: hashPassword('Stu1234567')
    })
  } else {
    result = await updateStudentRecord(userId, {
      gender: body.gender,
      birthDate: body.birthDate,
      phone: body.phone,
      address: body.address,
      guardianPhone: body.guardianPhone,
      major: body.major
    })
  }

  if (tableId && table?.type === 'partial' && table.id !== BASIC_INFO_TABLE_ID) {
    await addStudentToDynamicTable(table.id, userId)
    if (existing && existing.name !== name) {
      result = await getStudentProfileByUserId(userId)
    }
  }

  await appendUserLog(user, 'create', 'students', `新增学生 ${userId}`)

  return result
    ? {
        userId: result.userId,
        name: result.name,
        className: result.className,
        gender: result.gender,
        birthDate: result.birthDate,
        phone: result.phone,
        address: result.address,
        guardianPhone: result.guardianPhone,
        major: result.major,
        passwordHash: result.passwordHash
      }
    : result
})
