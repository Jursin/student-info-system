import type { H3Event } from 'h3'
import type { UserAccount } from './store'
import { createOperationLog, deleteSessionToken, findSessionUserByToken } from './store'

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  }
}

export function setSessionCookie(event: H3Event, token: string, remember: boolean) {
  const cookieOptions = getSessionCookieOptions()
  if (remember) {
    setCookie(event, 'sis_session', token, {
      ...cookieOptions,
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
    })
    return
  }

  setCookie(event, 'sis_session', token, cookieOptions)
}

export async function getSessionUser(event: H3Event) {
  const token = getCookie(event, 'sis_session')
  if (!token) {
    return null
  }

  return findSessionUserByToken(token)
}

export async function requireSessionUser(event: H3Event) {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: '请先登录' })
  }

  return user
}

export async function appendLog(params: {
  operatorId: string
  operatorName: string
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout'
  target: string
  detail: string
}) {
  await createOperationLog(params)
}

export async function appendUserLog(
  user: Pick<UserAccount, 'userId' | 'name' | 'role'>,
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout',
  target: string,
  detail: string
) {
  const isPrivilegedLogin = action === 'login'
    && ['admin', 'superAdmin', 'classLeader'].includes(user.role)

  const isTableMutationByAdmin = ['create', 'update', 'delete'].includes(action)
    && target === 'tables'
    && ['admin', 'superAdmin'].includes(user.role)

  if (!isPrivilegedLogin && !isTableMutationByAdmin) {
    return
  }

  await appendLog({
    operatorId: user.userId,
    operatorName: user.name,
    action,
    target,
    detail
  })
}

export function defineAuthedHandler<T>(options: {
  authorize?: (user: UserAccount, event: H3Event) => void | Promise<void>
  run: (event: H3Event, user: UserAccount) => Promise<T>
  log?: {
    action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout'
    target: string
    detail: string | ((result: T, user: UserAccount, event: H3Event) => string)
  }
}) {
  return eventHandler(async (event) => {
    const user = await requireSessionUser(event)
    if (options.authorize) {
      await options.authorize(user, event)
    }

    const result = await options.run(event, user)

    if (options.log) {
      const detail = typeof options.log.detail === 'function'
        ? options.log.detail(result, user, event)
        : options.log.detail

      await appendUserLog(user, options.log.action, options.log.target, detail)
    }

    return result
  })
}

export async function invalidateSessionToken(token: string): Promise<void> {
  await deleteSessionToken(token)
}
