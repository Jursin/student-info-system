import { canManageAllStudents, canViewClassData } from '../../utils/access'
import { appendUserLog, requireSessionUser } from '../../utils/auth'
import { listStudentProfiles } from '../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const query = getQuery(event)
  const className = typeof query.className === 'string' ? query.className : ''

  let result = await listStudentProfiles()

  if (user.role === 'student') {
    result = await listStudentProfiles({ userId: user.userId })
  } else if (user.role === 'classLeader') {
    result = await listStudentProfiles({ className: user.className })
  }

  if (className && canViewClassData(user)) {
    result = result.filter(item => item.className === className)
  }

  await appendUserLog(user, 'read', 'students', canManageAllStudents(user) ? '查询全体学生信息' : '查询可见学生信息')

  return result.map(item => ({
    userId: item.userId,
    name: item.name,
    className: item.className,
    gender: item.gender,
    birthDate: item.birthDate,
    phone: item.phone,
    address: item.address,
    guardianPhone: item.guardianPhone,
    major: item.major,
    passwordHash: item.passwordHash
  }))
})
