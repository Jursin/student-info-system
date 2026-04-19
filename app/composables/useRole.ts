export const useRole = () => {
  const { user } = useAuth()

  const isStudent = computed(() => user.value?.role === 'student')
  const isClassLeader = computed(() => user.value?.role === 'classLeader')
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'superAdmin')
  const isSuperAdmin = computed(() => user.value?.role === 'superAdmin')

  return {
    isStudent,
    isClassLeader,
    isAdmin,
    isSuperAdmin
  }
}
