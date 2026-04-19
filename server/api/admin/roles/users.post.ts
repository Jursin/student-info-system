import { isSuperAdmin } from '../../../utils/access'
import { appendUserLog, requireSessionUser } from '../../../utils/auth'
import { createUserAccount, findUserByUserId, getStudentProfileByUserId, type UserRole } from '../../../utils/store'
import { isStrongPassword } from '../../../utils/security'

interface CreateBody {
  userId: string
  password: string
  role: UserRole
  name?: string
  className?: string
}

const ALLOWED_ROLES: UserRole[] = ['admin', 'classLeader']

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  if (!isSuperAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: '无权限管理角色' })
  }

  const body = await readBody<CreateBody>(event)
  const userId = body.userId?.trim()
  const password = body.password?.trim()
  const role = body.role
  const name = body.name?.trim() || userId
  const className = body.className?.trim() || ''

  if (!userId || !password || !role) {
    throw createError({ statusCode: 400, statusMessage: '用户名/学号、密码、角色不能为空' })
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: '只允许创建管理员、学委角色' })
  }

  if (!isStrongPassword(password)) {
    throw createError({ statusCode: 400, statusMessage: '密码至少10位，且包含大小写字母和数字' })
  }

  const exists = await findUserByUserId(userId)
  if (exists) {
    throw createError({ statusCode: 400, statusMessage: '用户名/学号已存在' })
  }

  if (role === 'classLeader') {
    const student = await getStudentProfileByUserId(userId)
    if (!student) {
      throw createError({ statusCode: 400, statusMessage: '学委必须绑定已存在的学生用户名/学号' })
    }
  }

  const created = await createUserAccount({
    userId: userId,
    name,
    className,
    role,
    password
  })

  await appendUserLog(user, 'create', 'roles', `创建角色用户 ${userId}`)

  return {
    userId: created.userId,
    name: created.name,
    className: created.className,
    role: created.role
  }
})


