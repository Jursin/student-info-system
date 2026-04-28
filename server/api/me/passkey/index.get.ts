import { requireSessionUser } from '../../../utils/auth'
import { getPasskeyCredentialsByUserId } from '../../../utils/store'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const credentials = await getPasskeyCredentialsByUserId(user.userId)

  return credentials.map(cred => ({
    id: cred.id,
    name: cred.name,
    aaguid: cred.aaguid,
    createdAt: cred.createdAt
  }))
})
