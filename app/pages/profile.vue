<script setup lang="ts">
import * as z from 'zod'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'

const toast = useToast()

const schema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/, '新密码至少10位，且包含大小写字母和数字')
})

const state = reactive({
  currentPassword: '',
  newPassword: ''
})

const saving = ref(false)

async function updatePassword() {
  saving.value = true
  try {
    await $fetch('/api/me/password', {
      method: 'PUT',
      body: state
    })

    state.currentPassword = ''
    state.newPassword = ''
    toast.add({ title: '密码修改成功' })
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({
      color: 'error',
      title: '密码修改失败',
      description
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="profile">
    <template #header>
      <UDashboardNavbar title="个人中心">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <NavbarActions />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4 w-full max-w-none">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-highlighted">
              修改密码
            </h2>
          </template>

          <UForm
            :schema="schema"
            :state="state"
            class="flex flex-col md:flex-row md:flex-wrap gap-4"
            @submit="updatePassword"
          >
            <UFormField name="currentPassword" label="当前密码">
              <UInput
                v-model="state.currentPassword"
                type="password"
                placeholder="请输入当前密码"
                class="w-full md:w-100"
              />
            </UFormField>

            <UFormField name="newPassword" label="新密码">
              <UInput
                v-model="state.newPassword"
                type="password"
                placeholder="至少10位且包含大小写字母和数字"
                class="w-full md:w-100"
              />
            </UFormField>

            <div class="md:basis-full flex justify-start w-full">
              <UButton type="submit" :loading="saving">
                更新密码
              </UButton>
            </div>
          </UForm>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
