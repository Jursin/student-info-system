import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { storeChallenge } from '../../../../utils/webauthn'

export default eventHandler(async (event) => {
  const host = getHeader(event, 'host') || 'localhost'

  const options = await generateAuthenticationOptions({
    rpID: host,
    allowCredentials: [],
    userVerification: 'preferred'
  })

  storeChallenge(undefined, options.challenge, 'authentication')

  return options
})
