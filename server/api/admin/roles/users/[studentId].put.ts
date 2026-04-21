import { isSuperAdmin } from '../../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../../utils/auth'
import { isStrongPassword } from '../../../../utils/security'
import { findUserByUserId, getStudentProfileByUserId, type UserRole, updateUserAccountByUserId } from '../../../../utils/store'

interface UpdateBody {
  userId?: string
  name?: string
  className?: string
  role?: UserRole
  password?: string
}

const ALLOWED_ROLES: UserRole[] = ['admin', 'classLeader']

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (user.role !== 'admin' && !isSuperAdmin(user)) {
    throw createError({ statusCode: 403, message: '无权限管理角色' })
  }

  const userId = getRouterParam(event, 'studentId')
  if (!userId) {
    throw createError({ statusCode: 400, message: '缺少用户名/学号参数' })
  }

  const current = await findUserByUserId(userId)
  if (!current) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const body = await readBody<UpdateBody>(event)

  if (user.role === 'admin' && current.role === 'admin' && current.userId !== user.userId) {
    throw createError({ statusCode: 403, message: '管理员不可修改其它管理员信息' })
  }

  if (current.role === 'superAdmin' && !isSuperAdmin(user)) {
    throw createError({ statusCode: 403, message: '管理员不可编辑超级管理员信息' })
  }

  if (current.role === 'classLeader' && (body.name !== undefined || body.className !== undefined)) {
    throw createError({ statusCode: 400, message: '编辑班委角色时不允许修改姓名和班级' })
  }

  if (current.role === 'superAdmin') {
    const hasRestrictedField = body.userId !== undefined || body.className !== undefined || body.role !== undefined || (body.password?.trim() || '') !== ''
    if (hasRestrictedField) {
      throw createError({ statusCode: 400, message: '超级管理员仅允许修改姓名' })
    }

    const nextName = body.name?.trim()
    if (!nextName) {
      throw createError({ statusCode: 400, message: '姓名不能为空' })
    }

    const updated = await updateUserAccountByUserId(userId, {
      name: nextName
    })

    if (!updated) {
      throw createError({ statusCode: 404, message: '用户不存在' })
    }

    await appendUserLog(user, 'update', 'roles', `修改角色用户 ${userId}`)

    return {
      userId: updated.userId,
      name: updated.name,
      className: updated.className,
      role: updated.role
    }
  }

  const nextUserId = body.userId?.trim()
  const nextName = body.name?.trim()
  const nextClassName = body.className?.trim() || ''
  const nextRole = body.role
  const nextPassword = body.password?.trim()

  if (body.userId !== undefined && !nextUserId) {
    throw createError({ statusCode: 400, message: '用户名/学号不能为空' })
  }

  if (body.name !== undefined && !nextName) {
    throw createError({ statusCode: 400, message: '姓名不能为空' })
  }

  if (nextRole !== undefined && !ALLOWED_ROLES.includes(nextRole)) {
    throw createError({ statusCode: 400, message: '只允许设置管理员、班委角色' })
  }

  if (nextPassword !== undefined && nextPassword && !isStrongPassword(nextPassword)) {
    throw createError({ statusCode: 400, message: '密码至少10位，且包含大小写字母和数字' })
  }

  const finalRole = nextRole ?? current.role
  const finalUserId = nextUserId ?? current.userId
  if (finalRole === 'classLeader') {
    const student = await getStudentProfileByUserId(finalUserId)
    if (!student) {
      throw createError({ statusCode: 400, message: '班委必须绑定已存在的学生用户名/学号' })
    }
  }

  const updated = await updateUserAccountByUserId(userId, {
    nextUserId,
    name: nextName,
    className: body.className === undefined ? undefined : nextClassName,
    role: nextRole,
    password: nextPassword || undefined
  })

  if (!updated) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  await appendUserLog(user, 'update', 'roles', `修改角色用户 ${userId}`)

  return {
    userId: updated.userId,
    name: updated.name,
    className: updated.className,
    role: updated.role
  }
})
