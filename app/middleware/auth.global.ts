export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/admin/login') {
    return
  }

  const { ready, isLoggedIn, refreshSession } = useAuth()

  if (!ready.value) {
    await refreshSession()
  }

  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
