<script setup lang="ts">
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
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
const { login, loginAdmin, verifyTotp, loginWithPasskey, pendingTotp } = useAuth()

const loading = ref(false)
const totpVerifying = ref(false)

const showTotpStep = computed(() => pendingTotp.value !== null)

const accountLabel = computed(() => props.mode === 'admin' ? '用户名' : '学号')

const schema = z.object({
  userId: z.string().min(1, '请输入账号'),
  password: z.string().min(10, '密码至少10位，需包含大小写字母和数字'),
  rememberLogin: z.boolean().default(false)
})

type Schema = z.output<typeof schema>

const totpSchema = z.object({
  totpCode: z.union([
    z.string().length(6, '请输入6位验证码'),
    z.array(z.string()).length(6, '请输入6位验证码').transform(arr => arr.join(''))
  ]).catch('请输入6位验证码')
})

type TotpSchema = z.output<typeof totpSchema>

const totpFields: AuthFormField[] = [
  {
    name: 'totpCode',
    type: 'otp',
    label: '验证码',
    length: 6
  }
]

const loginFields = computed<AuthFormField[]>(() => {
  const label = accountLabel.value
  return [
    {
      name: 'userId',
      type: 'text',
      label,
      placeholder: `请输入${label}`,
      required: true,
      defaultValue: ''
    },
    {
      name: 'password',
      type: 'password',
      label: '密码',
      placeholder: '请输入密码',
      required: true,
      defaultValue: ''
    },
    {
      name: 'rememberLogin',
      type: 'checkbox',
      label: '记住登录状态',
      defaultValue: false
    }
  ]
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const { userId, password, rememberLogin } = event.data

    if (props.mode === 'admin') {
      await loginAdmin(userId, password, rememberLogin)
    } else {
      await login(userId, password, rememberLogin)
    }

    if (!showTotpStep.value) {
      toast.add({ title: '登录成功' })
      emit('success')
    }
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || `请检查${accountLabel.value}和密码`
    toast.add({
      color: 'error',
      title: '登录失败',
      description
    })
  } finally {
    loading.value = false
  }
}

async function onTotpSubmit(event: FormSubmitEvent<TotpSchema>) {
  totpVerifying.value = true
  try {
    await verifyTotp(event.data.totpCode)
    toast.add({ title: '登录成功' })
    emit('success')
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '两步验证失败'
    toast.add({
      color: 'error',
      title: '验证失败',
      description
    })
  } finally {
    totpVerifying.value = false
  }
}

async function onPasskeyLogin() {
  try {
    const ok = await loginWithPasskey()
    if (ok) {
      toast.add({ title: '登录成功' })
      emit('success')
    }
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '通行密钥登录失败'
    toast.add({
      color: 'error',
      title: '登录失败',
      description
    })
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
            {{ showTotpStep ? '请输入两步验证码' : (props.mode === 'admin' ? '请使用管理员用户名和密码登录' : '请使用学号和密码登录') }}
          </p>
        </div>
        <UColorModeButton />
      </div>
    </template>

    <!-- Password login form -->
    <UAuthForm
      v-if="!showTotpStep"
      :fields="loginFields"
      :schema="schema"
      :submit="{ label: '登录' }"
      :loading="loading"
      :on-submit="onSubmit as any"
    >
      <template #footer>
        <div class="my-4">
          <div class="flex items-center text-xs uppercase">
            <span class="flex-1 border-t border-muted-foreground/20" />
            <span class="mx-2 bg-card text-muted whitespace-nowrap">或</span>
            <span class="flex-1 border-t border-muted-foreground/20" />
          </div>
        </div>

        <UButton variant="outline" block @click="onPasskeyLogin">
          <UIcon name="i-lucide-key-round" />
          使用通行密钥登录
        </UButton>
      </template>
    </UAuthForm>

    <!-- TOTP verification step -->
    <UAuthForm
      v-else
      :fields="totpFields"
      :schema="totpSchema"
      :submit="{ label: '验证' }"
      :loading="totpVerifying"
      :on-submit="onTotpSubmit as any"
    >
      <template #description>
        <p class="text-sm text-muted text-left">
          此账号已启用两步验证，请输入认证器应用中显示的验证码。
        </p>
      </template>
    </UAuthForm>
  </UCard>
</template>
