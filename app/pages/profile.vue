<script setup lang="ts">
import * as z from 'zod'
import { getRequestErrorMessage } from '~/utils/error'

const toast = useToast()

// ── 修改密码 ──
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
    await $fetch('/api/me/password', { method: 'PUT', body: state })
    state.currentPassword = ''
    state.newPassword = ''
    toast.add({ title: '密码修改成功' })
  } catch (error: unknown) {
    toast.add({ color: 'error', title: '密码修改失败', description: getRequestErrorMessage(error) })
  } finally {
    saving.value = false
  }
}

// ── 两步验证 ──
const totpState = ref<'off' | 'setup' | 'on'>('off')
const totpSecret = ref('')
const totpQrDataUrl = ref('')
const totpCode = ref('')
const totpVerifying = ref(false)
const disableTotpConfirmOpen = ref(false)
const disableTotpConfirmLoading = ref(false)

async function checkTotpStatus() {
  const { enabled } = await $fetch<{ enabled: boolean }>('/api/me/totp/status')
  if (enabled) {
    totpState.value = 'on'
  }
}

async function enableTotp() {
  if (totpState.value !== 'off') return
  totpState.value = 'setup'
  const res = await $fetch<{ secret: string, otpauth: string }>('/api/me/totp/setup', { method: 'POST' })
  totpSecret.value = res.secret
  const QRCode = (await import('qrcode')).default
  totpQrDataUrl.value = await QRCode.toDataURL(res.otpauth)
}

async function verifyTotpSetup() {
  if (!totpCode.value || totpCode.value.length !== 6) return
  totpVerifying.value = true
  try {
    await $fetch('/api/me/totp/verify', { method: 'POST', body: { code: totpCode.value, secret: totpSecret.value } })
    totpState.value = 'on'
    totpCode.value = ''
    totpQrDataUrl.value = ''
    toast.add({ title: '两步验证已启用' })
  } catch (error: unknown) {
    toast.add({ color: 'error', title: '验证失败', description: getRequestErrorMessage(error) })
  } finally {
    totpVerifying.value = false
  }
}

function requestDisableTotp() {
  disableTotpConfirmOpen.value = true
}

async function confirmDisableTotp() {
  disableTotpConfirmLoading.value = true
  try {
    await $fetch('/api/me/totp/disable', { method: 'DELETE' })
    totpState.value = 'off'
    totpSecret.value = ''
    toast.add({ title: '两步验证已禁用' })
    disableTotpConfirmOpen.value = false
  } catch (error: unknown) {
    toast.add({ color: 'error', title: '操作失败', description: getRequestErrorMessage(error) })
  } finally {
    disableTotpConfirmLoading.value = false
  }
}

// ── 通行密钥 ──
interface PasskeyEntry {
  id: number
  name: string
  aaguid: string
  createdAt: string
}

const passkeys = ref<PasskeyEntry[]>([])
const passkeyLoading = ref(false)

async function loadPasskeys() {
  passkeyLoading.value = true
  try {
    passkeys.value = await $fetch<PasskeyEntry[]>('/api/me/passkey')
  } finally {
    passkeyLoading.value = false
  }
}

// 注册通行密钥 + 命名弹窗
const passkeyNameModalOpen = ref(false)
const passkeyNameInput = ref('')
const passkeyNameSaving = ref(false)
const passkeyNameCredentialId = ref<number | null>(null)

async function registerPasskey() {
  try {
    const { startRegistration } = await import('@simplewebauthn/browser')

    const options = await $fetch('/api/me/passkey/register/begin', { method: 'POST' })

    const regResp = await startRegistration({ optionsJSON: options })

    const result = await $fetch<{ verified: boolean, aaguid: string, suggestedName: string }>(
      '/api/me/passkey/register/complete',
      { method: 'POST', body: regResp }
    )

    await loadPasskeys()

    const added = passkeys.value[passkeys.value.length - 1]
    if (added) {
      passkeyNameCredentialId.value = added.id
      passkeyNameInput.value = result.suggestedName
      passkeyNameModalOpen.value = true
    }
  } catch (error: unknown) {
    const err = error as { name?: string }
    if (err.name === 'AbortError' || err.name === 'NotAllowedError') return
    toast.add({ color: 'error', title: '添加失败', description: getRequestErrorMessage(error) })
  }
}

async function confirmPasskeyName() {
  if (!passkeyNameInput.value?.trim() || !passkeyNameCredentialId.value) return
  passkeyNameSaving.value = true
  try {
    await $fetch(`/api/me/passkey/${passkeyNameCredentialId.value}`, {
      method: 'PUT',
      body: { name: passkeyNameInput.value.trim() }
    })
    passkeyNameModalOpen.value = false
    toast.add({ title: '通行密钥添加成功' })
    await loadPasskeys()
  } catch (error: unknown) {
    toast.add({ color: 'error', title: '设置名称失败', description: getRequestErrorMessage(error) })
  } finally {
    passkeyNameSaving.value = false
  }
}

function startRenamePasskey(pk: PasskeyEntry) {
  passkeyNameCredentialId.value = pk.id
  passkeyNameInput.value = pk.name
  passkeyNameModalOpen.value = true
}

// 删除通行密钥确认
const deletePasskeyConfirmOpen = ref(false)
const deletePasskeyConfirmLoading = ref(false)
const deletePasskeyTarget = ref<{ id: number, name: string } | null>(null)

function requestDeletePasskey(pk: PasskeyEntry) {
  deletePasskeyTarget.value = { id: pk.id, name: pk.name }
  deletePasskeyConfirmOpen.value = true
}

async function confirmDeletePasskey() {
  if (!deletePasskeyTarget.value) return
  deletePasskeyConfirmLoading.value = true
  try {
    await $fetch(`/api/me/passkey/${deletePasskeyTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: '通行密钥已删除' })
    deletePasskeyConfirmOpen.value = false
    await loadPasskeys()
  } catch (error: unknown) {
    toast.add({ color: 'error', title: '删除失败', description: getRequestErrorMessage(error) })
  } finally {
    deletePasskeyConfirmLoading.value = false
  }
}

onMounted(() => {
  checkTotpStatus()
  loadPasskeys()
})
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
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-none">
        <!-- 修改密码 -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-highlighted">
              修改密码
            </h2>
          </template>

          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="updatePassword"
          >
            <UFormField name="currentPassword" label="当前密码">
              <UInput
                v-model="state.currentPassword"
                type="password"
                placeholder="请输入当前密码"
                class="w-full"
              />
            </UFormField>

            <UFormField name="newPassword" label="新密码">
              <UInput
                v-model="state.newPassword"
                type="password"
                placeholder="至少10位且包含大小写字母和数字"
                class="w-full"
              />
            </UFormField>

            <UButton type="submit" :loading="saving">
              更新密码
            </UButton>
          </UForm>
        </UCard>

        <!-- 通行密钥 -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-highlighted">
              通行密钥
            </h2>
          </template>

          <div v-if="passkeyLoading && passkeys.length === 0" class="py-4 text-center text-sm text-muted">
            加载中...
          </div>

          <!-- 无通行密钥时显示描述和添加按钮 -->
          <div v-else-if="passkeys.length === 0" class="space-y-3">
            <p class="text-sm text-muted">
              添加通行密钥后，可使用指纹、面容、PIN 码或浏览器扩展快速登录，无需输入密码。
            </p>
            <UButton @click="registerPasskey">
              <template #trailing>
                <UIcon name="i-lucide-key-round" />
              </template>
              添加通行密钥
            </UButton>
          </div>

          <!-- 已有通行密钥时仅显示列表 -->
          <div v-else class="space-y-3">
            <div v-for="pk in passkeys" :key="pk.id" class="flex items-center justify-between rounded-lg border p-3">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <UIcon name="i-lucide-key-round" class="size-5 shrink-0 text-muted" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium truncate">{{ pk.name }}</span>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-pencil"
                      @click="startRenamePasskey(pk)"
                    />
                  </div>
                  <p class="text-xs text-muted">
                    {{ new Date(pk.createdAt).toLocaleString('zh-CN') }}
                  </p>
                </div>
              </div>
              <UButton
                color="error"
                variant="soft"
                size="sm"
                @click="requestDeletePasskey(pk)"
              >
                删除
              </UButton>
            </div>
            <p class="text-sm text-muted">
              下次可使用指纹、面容、PIN 码或浏览器扩展快速登录，无需输入密码。
            </p>
          </div>
        </UCard>

        <!-- 两步验证 -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-highlighted">
              两步验证
            </h2>
          </template>

          <div v-if="totpState === 'off'" class="space-y-3">
            <p class="text-sm text-muted">
              启用两步验证后，登录时除密码外还需输入认证器应用生成的动态验证码，提升账号安全性。
            </p>
            <UButton @click="enableTotp">
              启用两步验证
            </UButton>
          </div>

          <div v-else-if="totpState === 'setup'" class="space-y-4">
            <p class="text-sm text-muted">
              使用认证器 App 扫描下方二维码，然后输入 App 中显示的 6 位验证码完成设置。
            </p>
            <div v-if="totpQrDataUrl" class="flex justify-left">
              <img :src="totpQrDataUrl" alt="TOTP QR Code" class="size-48">
            </div>
            <UFormField label="验证码" name="totpCode">
              <UInput
                v-model="totpCode"
                placeholder="输入6位验证码"
                class="w-full md:w-60 text-center tracking-widest"
                maxlength="6"
                @keypress.enter="verifyTotpSetup"
              />
            </UFormField>
            <div class="flex gap-2">
              <UButton variant="outline" @click="totpState = 'off'">
                取消
              </UButton>
              <UButton :disabled="totpCode.length !== 6" :loading="totpVerifying" @click="verifyTotpSetup">
                验证并启用
              </UButton>
            </div>
          </div>

          <div v-else class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-shield-check" class="size-5 text-success" />
              <span class="text-sm text-success font-medium">两步验证已启用</span>
            </div>
            <p class="text-sm text-muted">
              下次登录时除密码外还需输入认证器应用生成的动态验证码，提升账号安全性。
            </p>
            <UButton color="error" variant="soft" @click="requestDisableTotp">
              禁用两步验证
            </UButton>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <!-- 确认禁用两步验证 -->
  <UModal v-model:open="disableTotpConfirmOpen" title="确认禁用">
    <template #body>
      <p class="text-sm text-muted">
        禁用后，登录时将不再需要两步验证码。这可能会降低账号安全性，是否继续？
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="disableTotpConfirmLoading"
          @click="disableTotpConfirmOpen = false"
        >
          取消
        </UButton>
        <UButton color="error" :loading="disableTotpConfirmLoading" @click="confirmDisableTotp">
          确认禁用
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- 确认删除通行密钥 -->
  <UModal v-model:open="deletePasskeyConfirmOpen" title="确认删除">
    <template #body>
      <p class="text-sm text-muted">
        即将删除通行密钥「{{ deletePasskeyTarget?.name }}」，删除后无法再使用此密钥登录，是否继续？
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="deletePasskeyConfirmLoading"
          @click="deletePasskeyConfirmOpen = false"
        >
          取消
        </UButton>
        <UButton color="error" :loading="deletePasskeyConfirmLoading" @click="confirmDeletePasskey">
          确认删除
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- 通行密钥命名弹窗（新建和重命名共用） -->
  <UModal v-model:open="passkeyNameModalOpen" :title="passkeyNameCredentialId && passkeys.some(p => p.id === passkeyNameCredentialId) ? '重命名通行密钥' : '设置通行密钥名称'">
    <template #body>
      <UFormField label="名称" name="passkeyName">
        <UInput
          v-model="passkeyNameInput"
          placeholder="输入通行密钥名称"
          class="w-full"
          @keypress.enter="confirmPasskeyName"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="passkeyNameSaving"
          @click="passkeyNameModalOpen = false"
        >
          取消
        </UButton>
        <UButton :loading="passkeyNameSaving" :disabled="!passkeyNameInput?.trim()" @click="confirmPasskeyName">
          确认
        </UButton>
      </div>
    </template>
  </UModal>
</template>
