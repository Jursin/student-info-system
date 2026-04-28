import { verifyAuthenticationResponse, type AuthenticatorTransportFuture } from '@simplewebauthn/server'
import { randomUUID } from 'crypto'
import type { H3Event } from 'h3'
import { getPasskeyCredentialByCredentialId, updatePasskeyCredentialCounter, upsertSessionToken, findUserByUserId } from '../../../../utils/store'
import { getAndDeleteChallenge } from '../../../../utils/webauthn'
import { setSessionCookie, appendUserLog } from '../../../../utils/auth'

export default eventHandler(async (event) => {
  const host = getHeader(event, 'host') || 'localhost'
  const body = await readBody(event)

  if (!body?.id || !body?.response?.clientDataJSON) {
    throw createError({ statusCode: 400, message: '缺少凭据信息' })
  }

  const clientData = JSON.parse(
    Buffer.from(body.response.clientDataJSON, 'base64url').toString()
  )
  const storedChallenge = getAndDeleteChallenge(clientData.challenge, 'authentication')
  if (!storedChallenge) {
    throw createError({ statusCode: 400, message: '验证挑战已过期或无效，请重试' })
  }

  const credential = await getPasskeyCredentialByCredentialId(body.id)
  if (!credential) {
    throw createError({ statusCode: 400, message: '未找到此通行密钥' })
  }

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: storedChallenge.challenge,
    expectedOrigin: getOrigin(event),
    expectedRPID: host,
    credential: {
      id: credential.credentialId,
      publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64')),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransportFuture[]
    }
  })

  if (!verification.verified) {
    throw createError({ statusCode: 400, message: '通行密钥验证失败' })
  }

  await updatePasskeyCredentialCounter(credential.id, verification.authenticationInfo.newCounter)

  const user = await findUserByUserId(credential.userId)
  if (!user) {
    throw createError({ statusCode: 400, message: '用户账号不存在' })
  }

  const token = randomUUID()
  await upsertSessionToken({
    token,
    userId: user.userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 24 * 1000)
  })

  setSessionCookie(event, token, true)

  await appendUserLog(user, 'login', 'auth-passkey', '通行密钥登录系统')

  return {
    user: {
      userId: user.userId,
      name: user.name,
      className: user.className,
      role: user.role
    }
  }
})

function getOrigin(event: H3Event): string {
  const host = getHeader(event, 'host') || 'localhost'
  const proto = getHeader(event, 'x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}
