<script setup lang="ts">
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js';
import * as z from 'zod'

const props = withDefaults(defineProps<{
  mode?: 'student' | 'admin'
}>(), {
  mode: 'student'
})

const emit = defineEmits<{
  success: []
}>()

const toast = useToast()
const loading = ref(false)
const rememberLogin = ref(false)
const accountLabel = computed(() => props.mode === 'admin' ? '用户名' : '学号')

const schema = z.object({
  userId: z.string().min(1, '请输入账号'),
  password: z.string().min(10, '密码至少10位，需包含大小写字母和数字')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  userId: '',
  password: ''
})

async function onSubmit() {
  loading.value = true
  try {
    if (props.mode === 'admin') {
      await useAuth().loginAdmin(state.userId, state.password, rememberLogin.value)
    } else {
      await useAuth().login(state.userId, state.password, rememberLogin.value)
    }
    toast.add({ title: '登录成功' })
    emit('success')
  } catch (error: unknown) {
    const description = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || `请检查${accountLabel.value}和密码`
    toast.add({
      color: 'error',
      title: '登录失败',
      description
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="space-y-1">
          <h1 class="flex items-center gap-2 text-xl font-semibold text-highlighted">
            <UIcon name="i-lucide-graduation-cap" class="size-5 shrink-0 text-muted" />
            <span>学生信息管理系统</span>
          </h1>
          <p class="text-sm text-muted">
            {{ props.mode === 'admin' ? '请使用管理员用户名和密码登录' : '请使用学号和密码登录' }}
          </p>
        </div>
        <UColorModeButton />
      </div>
    </template>

    <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField :label="accountLabel" name="userId">
        <UInput v-model="state.userId" :placeholder="`请输入${accountLabel}`" class="w-full" />
      </UFormField>

      <UFormField label="密码" name="password">
        <UInput v-model="state.password" type="password" placeholder="请输入密码" class="w-full" />
      </UFormField>

      <UCheckbox v-model="rememberLogin" label="记住登录状态" />

      <UButton type="submit" block :loading="loading">
        登录
      </UButton>
    </UForm>
  </UCard>
</template>
