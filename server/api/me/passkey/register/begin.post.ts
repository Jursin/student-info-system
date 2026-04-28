import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { requireSessionUser } from '../../../../utils/auth'
import { getPasskeyCredentialsByUserId } from '../../../../utils/store'
import { storeChallenge } from '../../../../utils/webauthn'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const host = getHeader(event, 'host') || 'localhost'

  const existingCredentials = await getPasskeyCredentialsByUserId(user.userId)

  const options = await generateRegistrationOptions({
    rpName: '学生信息管理系统',
    rpID: host,
    userName: user.userId,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map(cred => ({
      id: cred.credentialId,
      transports: cred.transports as AuthenticatorTransportFuture[]
    }))
  })

  storeChallenge(user.userId, options.challenge, 'registration')

  return options
})
