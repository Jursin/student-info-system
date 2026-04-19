import type { H3Event } from 'h3'
import type { UserAccount } from './store'
import { createOperationLog, deleteSessionToken, findSessionUserByToken } from './store'

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
    throw createError({ statusCode: 401, statusMessage: '请先登录' })
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
  user: Pick<UserAccount, 'userId' | 'name'>,
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout',
  target: string,
  detail: string
) {
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
