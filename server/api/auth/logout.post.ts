import { appendUserLog, invalidateSessionToken, requireSessionUser } from '../../utils/auth'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const token = getCookie(event, 'sis_session')

  if (token) {
    await invalidateSessionToken(token)
  }

  deleteCookie(event, 'sis_session', { path: '/' })

  await appendUserLog(user, 'logout', 'auth', '用户退出系统')

  return { ok: true }
})
