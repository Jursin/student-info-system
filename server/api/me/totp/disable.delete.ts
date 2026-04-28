import { requireSessionUser } from '../../../utils/auth'
import { deleteTotpSecret } from '../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await deleteTotpSecret(user.userId)
  return { success: true }
})
