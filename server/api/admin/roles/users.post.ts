import { isSuperAdmin } from '../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../utils/auth'
import { createUserAccount, ensureStudentAccountByUserId, findUserByUserId, getStudentProfileByUserId, type UserRole, updateUserAccountByUserId } from '../../../utils/store'
import { isStrongPassword } from '../../../utils/security'

interface CreateBody {
  userId: string
  password?: string
  role: UserRole
  name?: string
  className?: string
}

const ALLOWED_ROLES: UserRole[] = ['admin', 'classLeader']

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (user.role !== 'admin' && !isSuperAdmin(user)) {
    throw createError({ statusCode: 403, message: '无权限管理角色' })
  }

  const body = await readBody<CreateBody>(event)
  const userId = body.userId?.trim()
  const password = body.password?.trim()
  const role = body.role

  if (!userId || !role) {
    throw createError({ statusCode: 400, message: '用户名/学号、角色不能为空' })
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw createError({ statusCode: 400, message: '只允许创建管理员、班委角色' })
  }

  if (role === 'classLeader') {
    const student = await getStudentProfileByUserId(userId)
    if (!student) {
      throw createError({ statusCode: 400, message: '班委必须绑定已存在的学生用户名/学号' })
    }

    const account = await ensureStudentAccountByUserId(userId)
    if (!account) {
      throw createError({ statusCode: 400, message: '未找到可绑定的学生账号' })
    }

    if (account.role === 'admin' || account.role === 'superAdmin') {
      throw createError({ statusCode: 400, message: '仅支持将学生账号设置为班委' })
    }

    if (account.role === 'classLeader') {
      throw createError({ statusCode: 400, message: '该学生已是班委' })
    }

    const updated = await updateUserAccountByUserId(userId, {
      role: 'classLeader',
      name: student.name,
      className: student.className
    })

    if (!updated) {
      throw createError({ statusCode: 404, message: '用户不存在' })
    }

    await appendUserLog(user, 'update', 'roles', `设置班委 ${userId}`)

    return {
      userId: updated.userId,
      name: updated.name,
      className: updated.className,
      role: updated.role
    }
  }

  if (!password) {
    throw createError({ statusCode: 400, message: '管理员必须填写密码' })
  }

  if (!isStrongPassword(password)) {
    throw createError({ statusCode: 400, message: '密码至少10位，且包含大小写字母和数字' })
  }

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '管理员必须填写用户名和姓名' })
  }

  const exists = await findUserByUserId(userId)
  if (exists) {
    throw createError({ statusCode: 400, message: '用户名/学号已存在' })
  }

  const name = body.name.trim()
  const className = body.className?.trim() || ''
  const finalPassword = password

  const created = await createUserAccount({
    userId: userId,
    name,
    className,
    role,
    password: finalPassword
  })

  await appendUserLog(user, 'create', 'roles', `创建角色用户 ${userId}`)

  return {
    userId: created.userId,
    name: created.name,
    className: created.className,
    role: created.role
  }
})
