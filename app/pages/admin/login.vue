<script setup lang="ts">
import LoginForm from '../../components/auth/LoginForm.vue'

definePageMeta({
  layout: false,
  middleware: []
})

const router = useRouter()
const { isLoggedIn, ready, refreshSession, user } = useAuth()

if (!ready.value) {
  await refreshSession()
}

if (isLoggedIn.value) {
  if (user.value?.role === 'admin' || user.value?.role === 'superAdmin') {
    await router.replace('/')
  } else {
    await router.replace('/login')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted/30 px-4">
    <div class="w-full max-w-md">
      <LoginForm mode="admin" @success="$router.push('/')" />
    </div>
  </div>
</template>
