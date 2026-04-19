export default defineNuxtRouteMiddleware(() => {
  const { user } = useAuth()

  if (!user.value || (user.value.role !== 'admin' && user.value.role !== 'superAdmin')) {
    return navigateTo('/')
  }
})
