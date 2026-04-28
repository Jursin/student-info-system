import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { H3Event } from 'h3'
import { requireSessionUser } from '../../../../utils/auth'
import { addPasskeyCredential } from '../../../../utils/store'
import { getAndDeleteChallenge } from '../../../../utils/webauthn'
import { getAuthenticatorName } from '../../../../utils/aaguid'

export default eventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const host = getHeader(event, 'host') || 'localhost'
  const body = await readBody(event)

  if (!body?.id || !body?.response?.clientDataJSON) {
    throw createError({ statusCode: 400, message: '缺少凭据信息' })
  }

  const clientData = JSON.parse(
    Buffer.from(body.response.clientDataJSON, 'base64url').toString()
  )
  const storedChallenge = getAndDeleteChallenge(clientData.challenge, 'registration')
  if (!storedChallenge) {
    throw createError({ statusCode: 400, message: '验证挑战已过期或无效，请重试' })
  }

  if (storedChallenge.userId !== user.userId) {
    throw createError({ statusCode: 403, message: '用户不匹配' })
  }

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: storedChallenge.challenge,
    expectedOrigin: getOrigin(event),
    expectedRPID: host
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw createError({ statusCode: 400, message: '通行密钥验证失败' })
  }

  const { registrationInfo } = verification
  const aaguid = registrationInfo.aaguid || ''
  const suggestedName = getAuthenticatorName(aaguid)

  await addPasskeyCredential({
    userId: user.userId,
    credentialId: registrationInfo.credential.id,
    publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64'),
    counter: registrationInfo.credential.counter,
    transports: body.response?.transports || [],
    backedUp: String(registrationInfo.credentialBackedUp),
    name: suggestedName,
    aaguid
  })

  return { verified: true, aaguid, suggestedName }
})

function getOrigin(event: H3Event): string {
  const host = getHeader(event, 'host') || 'localhost'
  const proto = getHeader(event, 'x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}
