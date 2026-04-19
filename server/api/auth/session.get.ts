import { getSessionUser } from '../../utils/auth'

export default eventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    return { user: null }
  }

  return {
    user: {
      userId: user.userId,
      name: user.name,
      className: user.className,
      role: user.role
    }
  }
})
