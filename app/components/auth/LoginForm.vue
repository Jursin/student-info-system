<script setup lang="ts">
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
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
const rememberLogin = ref(false)
const showPassword = ref(false)
const accountLabel = computed(() => props.mode === 'admin' ? '用户名' : '学号')

// TOTP state
const totpCode = ref('')
const totpVerifying = ref(false)

// The login form schema
const schema = z.object({
  userId: z.string().min(1, '请输入账号'),
  password: z.string().min(10, '密码至少10位，需包含大小写字母和数字')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  userId: '',
  password: ''
})

// Show TOTP step when pendingTotp is set
const showTotpStep = computed(() => pendingTotp.value !== null)

async function onSubmit() {
  loading.value = true
  try {
    if (props.mode === 'admin') {
      await loginAdmin(state.userId, state.password, rememberLogin.value)
    } else {
      await login(state.userId, state.password, rememberLogin.value)
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

async function onSubmitTotp() {
  if (!totpCode.value || totpCode.value.length !== 6) return

  totpVerifying.value = true
  try {
    await verifyTotp(totpCode.value)
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

function cancelTotp() {
  pendingTotp.value = null
  totpCode.value = ''
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
    <UForm
      v-if="!showTotpStep"
      :schema="schema"
      :state="state"
      class="space-y-4"
      @submit="onSubmit"
    >
      <UFormField :label="accountLabel" name="userId">
        <UInput v-model="state.userId" :placeholder="`请输入${accountLabel}`" class="w-full" />
      </UFormField>

      <UFormField label="密码" name="password">
        <UInput
          v-model="state.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="请输入密码"
          class="w-full"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>

      <UCheckbox v-model="rememberLogin" label="记住登录状态" />

      <UButton type="submit" block :loading="loading">
        登录
      </UButton>

      <div class="my-4">
        <div class="flex items-center text-xs uppercase">
          <span class="flex-1 border-t border-muted-foreground/20"></span>
          <span class="mx-2 bg-card text-muted whitespace-nowrap">或</span>
          <span class="flex-1 border-t border-muted-foreground/20"></span>
        </div>
      </div>

      <UButton variant="outline" block @click="onPasskeyLogin">
        <UIcon name="i-lucide-key-round" />
        使用通行密钥登录
      </UButton>
    </UForm>

    <!-- TOTP verification step -->
    <div v-else class="space-y-4">
      <p class="text-sm text-muted">
        此账号已启用两步验证，请输入认证器应用中显示的验证码。
      </p>

      <UFormField label="验证码" name="totpCode">
        <UInput
          v-model="totpCode"
          placeholder="输入6位验证码"
          class="w-full text-center text-lg tracking-widest"
          maxlength="6"
          @keypress.enter="onSubmitTotp"
        />
      </UFormField>

      <div class="flex gap-2">
        <UButton variant="outline" class="flex-1 justify-center items-center" @click="cancelTotp">
          返回
        </UButton>
        <UButton
          class="flex-1 justify-center items-center"
          :disabled="totpCode.length !== 6"
          :loading="totpVerifying"
          @click="onSubmitTotp"
        >
          验证
        </UButton>
      </div>
    </div>
  </UCard>
</template>
