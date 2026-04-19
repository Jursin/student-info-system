import type { SessionUser } from '~/types'

export const useAuth = () => {
  const user = useState<SessionUser | null>('auth-user', () => null)
  const ready = useState<boolean>('auth-ready', () => false)

  const isLoggedIn = computed(() => !!user.value)

  const requestFetch = process.server ? useRequestFetch() : $fetch

  async function refreshSession() {
    const data = await requestFetch<{ user: SessionUser | null }>('/api/auth/session')
    user.value = data.user
    ready.value = true
  }

  async function login(userId: string, password: string, remember = false) {
    const data = await $fetch<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: { userId, password, remember }
    })

    user.value = data.user
    ready.value = true
  }

  async function loginAdmin(userId: string, password: string, remember = false) {
    const data = await $fetch<{ user: SessionUser }>('/api/auth/admin-login', {
      method: 'POST',
      body: { userId, password, remember }
    })

    user.value = data.user
    ready.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    ready.value = true
  }

  return {
    user,
    ready,
    isLoggedIn,
    refreshSession,
    login,
    loginAdmin,
    logout
  }
}
