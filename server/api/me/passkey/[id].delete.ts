import { requireSessionUser } from '../../../utils/auth'
import { deletePasskeyCredentialById } from '../../../utils/store'

export default eventHandler(async (event) => {
  const _user = await requireSessionUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, message: '无效的 ID' })
  }

  await deletePasskeyCredentialById(id)
  return { success: true }
})
