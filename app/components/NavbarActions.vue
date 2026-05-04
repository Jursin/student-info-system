<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const toast = useToast()
const router = useRouter()
const { user, logout } = useAuth()

const currentUser = computed(() => ({
  name: user.value?.name || '未登录用户',
  avatar: {
    icon: 'i-lucide-user-round',
    alt: user.value?.name || '未登录用户',
    ui: {
      icon: 'size-4'
    }
  }
}))

async function handleLogout() {
  const role = user.value?.role
  await logout()
  toast.add({
    title: '已退出登录'
  })
  if (role === 'admin' || role === 'superAdmin') {
    await router.push('/admin/login')
    return
  }

  await router.push('/login')
}

const items = computed<DropdownMenuItem[][]>(() => ([[{
  label: '个人中心',
  icon: 'i-lucide-user-round',
  to: '/profile'
}], [{
  label: '退出登录',
  icon: 'i-lucide-log-out',
  onSelect: handleLogout
}]]))
</script>

<template>
  <div class="flex items-center gap-2">
    <UColorModeButton />
    <UDropdownMenu
      :items="items"
      :content="{ align: 'center', collisionPadding: 12 }"
      :ui="{
        content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)',
        item: 'py-2 items-center',
        itemLeadingIcon: 'size-4.5'
      }"
    >
      <UButton
        v-bind="{
          ...currentUser,
          label: currentUser?.name,
          trailingIcon: 'i-lucide-chevrons-up-down'
        }"
        color="neutral"
        variant="ghost"
        class="data-[state=open]:bg-elevated"
        :ui="{
          leadingAvatar: 'size-6',
          trailingIcon: 'text-dimmed'
        }"
      />
    </UDropdownMenu>
  </div>
</template>
