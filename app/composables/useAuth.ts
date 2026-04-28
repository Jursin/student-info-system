import type { SessionUser } from '~/types'

export const useAuth = () => {
  const user = useState<SessionUser | null>('auth-user', () => null)
  const ready = useState<boolean>('auth-ready', () => false)
  const pendingTotp = useState<{ userId: string, totpToken: string } | null>('pending-totp', () => null)

  const isLoggedIn = computed(() => !!user.value)

  const requestFetch = import.meta.server ? useRequestFetch() : $fetch

  async function refreshSession() {
    const data = await requestFetch<{ user: SessionUser | null }>('/api/auth/session')
    user.value = data.user
    ready.value = true
  }

  async function login(userId: string, password: string, remember = false) {
    const data = await $fetch<{ user?: SessionUser, requiresTotp?: boolean, totpToken?: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: { userId, password, remember }
      }
    )

    if (data.requiresTotp && data.totpToken) {
      pendingTotp.value = { userId, totpToken: data.totpToken }
      ready.value = true
      return
    }

    user.value = data.user!
    ready.value = true
  }

  async function loginAdmin(userId: string, password: string, remember = false) {
    const data = await $fetch<{ user?: SessionUser, requiresTotp?: boolean, totpToken?: string }>(
      '/api/auth/admin-login',
      {
        method: 'POST',
        body: { userId, password, remember }
      }
    )

    if (data.requiresTotp && data.totpToken) {
      pendingTotp.value = { userId, totpToken: data.totpToken }
      ready.value = true
      return
    }

    user.value = data.user!
    ready.value = true
  }

  async function verifyTotp(code: string) {
    if (!pendingTotp.value) {
      throw new Error('没有待验证的两步验证')
    }

    const data = await $fetch<{ user: SessionUser }>('/api/auth/totp/verify', {
      method: 'POST',
      body: { totpToken: pendingTotp.value.totpToken, code }
    })

    user.value = data.user
    pendingTotp.value = null
  }

  /**
   * 触发通行密钥（WebAuthn）认证并登录。
   * 登录成功返回 true，用户取消返回 false。
   */
  async function loginWithPasskey(): Promise<boolean> {
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser')

      const options = await $fetch('/api/auth/passkey/authenticate/begin', {
        method: 'POST'
      })

      const authResp = await startAuthentication({ optionsJSON: options })

      const data = await $fetch<{ user: SessionUser }>('/api/auth/passkey/authenticate/complete', {
        method: 'POST',
        body: authResp
      })

      user.value = data.user
      ready.value = true
      return true
    } catch (error: unknown) {
      const err = error as { name?: string }
      if (err.name === 'SecurityKeyDowngradeError'
        || err.name === 'AbortError'
        || err.name === 'NotAllowedError') {
        return false
      }
      throw error
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    ready.value = true
    pendingTotp.value = null
  }

  return {
    user,
    ready,
    isLoggedIn,
    pendingTotp,
    refreshSession,
    login,
    loginAdmin,
    verifyTotp,
    loginWithPasskey,
    logout
  }
}
