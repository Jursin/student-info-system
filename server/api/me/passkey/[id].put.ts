import { requireSessionUser } from '../../../utils/auth'
import { updatePasskeyCredentialName } from '../../../utils/store'

interface RenameBody {
  name: string
}

export default eventHandler(async (event) => {
  const _user = await requireSessionUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<RenameBody>(event)

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, message: '无效的 ID' })
  }

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '名称不能为空' })
  }

  await updatePasskeyCredentialName(id, body.name.trim())
  return { success: true }
})
