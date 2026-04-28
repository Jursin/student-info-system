import { requireSessionUser } from '../../../utils/auth'
import { getTotpSecret } from '../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const secret = await getTotpSecret(user.userId)

  return { enabled: !!secret }
})
