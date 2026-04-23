<script setup lang="ts">
import { getPaginationRowModel } from '@tanstack/table-core'
import type { SortingState } from '@tanstack/table-core'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { UserRole } from '~/types'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { getRequestErrorMessage } from '~/utils/error'
import { buildSortableHeader } from '~/utils/table'

definePageMeta({
  middleware: ['admin']
})

interface RoleUser {
  userId: string
  name: string
  className: string
  role: UserRole
}

const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UBadge = resolveComponent('UBadge')

type RolesTableRow = {
  id: string
  original: RoleUser
  getIsSelected: () => boolean
  toggleSelected: (value: boolean) => void
}

type RolesTableRef = {
  tableApi?: {
    getColumn: (id: string) => { setFilterValue: (value: string | undefined) => void } | undefined
    getFilteredSelectedRowModel: () => { rows: RolesTableRow[] }
    getFilteredRowModel: () => { rows: RolesTableRow[] }
    getState: () => { pagination: { pageIndex: number, pageSize: number } }
    setPageIndex: (pageIndex: number) => void
  }
}

const toast = useToast()
const { isAdmin } = useRole()
const { user } = useAuth()
const tableRef = ref<RolesTableRef | null>(null)
const createOpen = ref(false)
const editOpen = ref(false)
const creating = ref(false)
const updating = ref(false)
const resetting = ref(false)
const roleActionConfirmOpen = ref(false)
const roleActionConfirmLoading = ref(false)
const roleActionType = ref<'delete' | 'reset'>('delete')
const roleActionIds = ref<string[]>([])
const roleActionNames = ref<string[]>([])
const keyword = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 20 })
const columnFilters = ref([{ id: 'userId', value: '' }])
const sorting = ref<SortingState>([])
const rowSelection = ref({})

const formState = reactive({
  userId: '',
  name: '',
  className: '',
  password: '',
  role: 'admin' as 'admin' | 'classLeader'
})

const editingId = ref('')
const editingRole = ref<UserRole | null>(null)
const isEditingSuperAdmin = computed(() => editingRole.value === 'superAdmin')
const isEditingMode = computed(() => Boolean(editingId.value))
const roleFormOpen = computed({
  get: () => createOpen.value || editOpen.value,
  set: (value: boolean) => {
    if (!value) {
      createOpen.value = false
      editOpen.value = false
      resetForm()
    }
  }
})
const roleFormTitle = computed(() => isEditingMode.value ? '修改角色' : '添加角色')
const roleFormId = computed(() => isEditingMode.value ? 'edit-role-user-form' : 'create-role-user-form')
const roleFormSubmitText = computed(() => isEditingMode.value ? '保存修改' : '创建')
const roleFormLoading = computed(() => isEditingMode.value ? updating.value : creating.value)

const { data: users, status, refresh } = await useFetch<RoleUser[]>('/api/admin/roles/users', {
  default: () => []
})

const roleLabelMap: Record<UserRole, string> = {
  student: '学生',
  classLeader: '班委',
  admin: '管理员',
  superAdmin: '超级管理员'
}

const roleColorMap: Record<UserRole, 'neutral' | 'primary' | 'success' | 'warning' | 'error'> = {
  student: 'neutral',
  classLeader: 'success',
  admin: 'warning',
  superAdmin: 'primary'
}

const roleItems = [
  { label: '管理员', value: 'admin' },
  { label: '班委', value: 'classLeader' }
]

const columnVisibility = ref<Record<string, boolean>>({})

const usersData = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) {
    return users.value
  }

  return users.value.filter((item) => {
    const role = roleLabelMap[item.role]
    return [item.userId, item.name, item.className, role]
      .some(text => String(text || '').toLowerCase().includes(q))
  })
})

function canManageRoleRow(row: RoleUser) {
  if (!isAdmin.value || row.role === 'superAdmin') {
    return false
  }

  if (user.value?.role === 'admin' && row.role === 'admin' && row.userId !== user.value.userId) {
    return false
  }

  return true
}

function getSelectableRoleRows(rows: RolesTableRow[]) {
  return rows.filter(row => row.original.role !== 'superAdmin')
}

function getNextRoleRowSelection(pageRows: RolesTableRow[], checked: boolean) {
  const selectableRows = getSelectableRoleRows(pageRows)
  const selectableRowIds = new Set(selectableRows.map(row => row.id))
  const currentSelection = rowSelection.value as Record<string, boolean>

  if (checked) {
    const nextSelection: Record<string, boolean> = { ...currentSelection }
    for (const row of selectableRows) {
      nextSelection[row.id] = true
    }

    return nextSelection
  }

  return Object.fromEntries(
    Object.entries(currentSelection).filter(([rowId]) => !selectableRowIds.has(rowId))
  ) as Record<string, boolean>
}

const selectedActionableRows = computed(() => {
  const rows = tableRef.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  return rows.filter(row => canManageRoleRow(row.original))
})

const selectedActionableCount = computed(() => selectedActionableRows.value.length)

const roleActionConfirmTitle = computed(() => roleActionType.value === 'delete' ? '确认删除' : '确认重置密码')
const roleActionConfirmDescription = computed(() => {
  const count = roleActionIds.value.length
  if (roleActionType.value === 'delete') {
    return count > 1
      ? `即将删除 ${count} 名用户，删除后不可恢复，是否继续？`
      : `即将删除用户 ${roleActionNames.value[0] || roleActionIds.value[0] || ''}，删除后不可恢复，是否继续？`
  }

  return count > 1
    ? `即将重置 ${count} 名用户的密码，是否继续？`
    : `即将重置用户 ${roleActionNames.value[0] || roleActionIds.value[0] || ''} 的密码，是否继续？`
})

const columns: TableColumn<RoleUser>[] = [
  {
    id: 'select',
    header: ({ table }) => {
      const pageRows = table.getPaginationRowModel().rows as RolesTableRow[]
      const selectableRows = getSelectableRoleRows(pageRows)
      const allSelected = selectableRows.length > 0 && selectableRows.every(row => row.getIsSelected())
      const someSelected = selectableRows.some(row => row.getIsSelected())

      return h(UCheckbox, {
        'modelValue': someSelected && !allSelected ? 'indeterminate' : allSelected,
        'onUpdate:modelValue': () => {
          rowSelection.value = getNextRoleRowSelection(pageRows, !allSelected)
        },
        'aria-label': 'Select all',
        'class': 'align-middle'
      })
    },
    cell: ({ row }) => h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
      'disabled': row.original.role === 'superAdmin',
      'aria-label': 'Select row',
      'class': 'align-middle'
    }),
    enableHiding: false
  },
  {
    accessorKey: 'userId',
    header: ({ column }) => buildSortableHeader(UButton, column, '用户名/学号')
  },
  {
    accessorKey: 'name',
    header: ({ column }) => buildSortableHeader(UButton, column, '姓名')
  },
  {
    accessorKey: 'role',
    header: ({ column }) => buildSortableHeader(UButton, column, '角色'),
    cell: ({ row }) => h(UBadge, {
      color: roleColorMap[row.original.role],
      variant: 'subtle'
    }, () => roleLabelMap[row.original.role])
  },
  {
    accessorKey: 'className',
    header: ({ column }) => buildSortableHeader(UButton, column, '班级'),
    cell: ({ row }) => {
      if (row.original.role === 'admin' || row.original.role === 'superAdmin') {
        return ''
      }

      return row.original.className
    }
  },
  {
    id: 'actions',
    header: '',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    enableHiding: false,
    cell: ({ row }) => {
      if (!canManageRoleRow(row.original)) {
        return h('div')
      }

      return h('div', { class: 'text-right' }, h(UDropdownMenu, {
        items: getRowItems(row.original),
        content: { align: 'end' }
      }, () => h(UButton, {
        icon: 'i-lucide-ellipsis-vertical',
        color: 'neutral',
        variant: 'ghost'
      })))
    }
  }
]

const userIdLabel = computed(() => formState.role === 'admin' ? '用户名' : '学号')
const isAdminType = computed(() => formState.role === 'admin')
const isCreatingClassLeader = computed(() => !editingId.value && formState.role === 'classLeader')
const showAdminPasswordInput = computed(() => !isEditingMode.value && formState.role === 'admin')
const classLeaderLookupLoading = ref(false)
const classLeaderLookupMessage = ref('')
let classLeaderLookupTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, (value) => {
  const column = tableRef.value?.tableApi?.getColumn('userId')
  column?.setFilterValue(value || undefined)
})

function getRowItems(row: RoleUser): DropdownMenuItem[] {
  if (!canManageRoleRow(row)) {
    return []
  }

  const items: DropdownMenuItem[] = []

  items.push({
    label: '修改',
    icon: 'i-lucide-pencil',
    onSelect: () => openEdit(row)
  })

  if (row.role !== 'superAdmin') {
    items.push({
      label: '删除',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect: () => openRoleActionConfirm('delete', [row])
    })
  }

  return items
}

function sanitizeTextInput(value: unknown, maxLength: number) {
  return String(value ?? '').slice(0, maxLength)
}

function sanitizeNameInput(value: unknown) {
  return sanitizeTextInput(value, 10)
}

function sanitizeClassNameInput(value: unknown) {
  return sanitizeTextInput(value, 20)
}

function sanitizeUserIdInput(value: unknown) {
  const raw = String(value ?? '')
  const sanitized = formState.role === 'admin'
    ? raw.replace(/[^\w]/g, '')
    : raw.replace(/\D+/g, '')

  return sanitizeTextInput(sanitized, 20)
}

function updateFormName(value: unknown) {
  formState.name = sanitizeNameInput(value)
}

function updateFormUserId(value: unknown) {
  formState.userId = sanitizeUserIdInput(value)
}

function updateFormClassName(value: unknown) {
  formState.className = sanitizeClassNameInput(value)
}

function resetForm() {
  formState.userId = ''
  formState.name = ''
  formState.className = ''
  formState.password = ''
  formState.role = 'admin'
  editingId.value = ''
  editingRole.value = null
  classLeaderLookupMessage.value = ''
}

async function fillClassLeaderProfileByUserId() {
  if (!isCreatingClassLeader.value) {
    return
  }

  const userId = formState.userId.trim()
  if (!userId) {
    formState.name = ''
    formState.className = ''
    classLeaderLookupMessage.value = ''
    return
  }

  classLeaderLookupLoading.value = true
  try {
    const students = await $fetch<Array<{ userId: string, name: string, className: string }>>('/api/students')
    const matched = students.find(item => item.userId === userId)

    if (!matched) {
      formState.name = ''
      formState.className = ''
      classLeaderLookupMessage.value = '未找到该学号的基本信息'
      return
    }

    formState.name = matched.name
    formState.className = matched.className
    classLeaderLookupMessage.value = '已从基本信息表自动填充姓名与班级'
  } catch {
    formState.name = ''
    formState.className = ''
    classLeaderLookupMessage.value = '读取基本信息失败，请稍后重试'
  } finally {
    classLeaderLookupLoading.value = false
  }
}

function validateForm(state: typeof formState) {
  const errors: Array<{ name: string, message: string }> = []

  if (editingId.value && isEditingSuperAdmin.value) {
    if (!state.name.trim()) {
      errors.push({ name: 'name', message: '请输入姓名' })
    }

    return errors
  }

  if (!state.userId.trim()) {
    errors.push({ name: 'userId', message: `请输入${userIdLabel.value}` })
  }

  if (!isCreatingClassLeader.value && !state.name.trim()) {
    errors.push({ name: 'name', message: '请输入姓名' })
  }

  if (!isCreatingClassLeader.value && !isAdminType.value && !state.className.trim()) {
    errors.push({ name: 'className', message: '请输入班级' })
  }

  if (showAdminPasswordInput.value && !state.password.trim()) {
    errors.push({ name: 'password', message: '请输入密码' })
  }

  return errors
}

function openCreate() {
  resetForm()
  createOpen.value = true
}

function openEdit(row: RoleUser) {
  resetForm()
  editingId.value = row.userId
  editingRole.value = row.role
  formState.userId = row.userId
  formState.name = row.name
  formState.className = row.className
  formState.role = (row.role === 'superAdmin' ? 'admin' : row.role) as 'admin' | 'classLeader'
  editOpen.value = true
}

async function createUser() {
  creating.value = true
  try {
    const body: {
      userId: string
      role: 'admin' | 'classLeader'
      name?: string
      className?: string
      password?: string
    } = {
      userId: formState.userId,
      role: formState.role,
      name: formState.name,
      className: formState.className
    }

    if (formState.role === 'admin') {
      body.password = formState.password.trim()
    }

    await $fetch('/api/admin/roles/users', {
      method: 'POST',
      body
    })

    toast.add({ title: '创建成功' })
    createOpen.value = false
    resetForm()
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: '创建失败', description })
  } finally {
    creating.value = false
  }
}

watch(() => formState.role, (role) => {
  if (!editingId.value && role === 'classLeader') {
    formState.name = ''
    formState.className = ''
    classLeaderLookupMessage.value = ''
  }
})

watch(() => formState.userId, () => {
  if (classLeaderLookupTimer) {
    clearTimeout(classLeaderLookupTimer)
    classLeaderLookupTimer = null
  }

  if (!isCreatingClassLeader.value) {
    return
  }

  classLeaderLookupTimer = setTimeout(() => {
    void fillClassLeaderProfileByUserId()
  }, 300)
})

onBeforeUnmount(() => {
  if (classLeaderLookupTimer) {
    clearTimeout(classLeaderLookupTimer)
    classLeaderLookupTimer = null
  }
})

async function updateUser() {
  if (!editingId.value) {
    return
  }

  updating.value = true
  try {
    const body: Record<string, string> = {}
    if (isEditingSuperAdmin.value) {
      body.name = formState.name
    } else {
      body.userId = formState.userId
      body.role = formState.role

      if (editingRole.value !== 'classLeader') {
        body.name = formState.name
        body.className = isAdminType.value ? '' : formState.className
      }
    }

    await $fetch(`/api/admin/roles/users/${editingId.value}`, {
      method: 'PUT',
      body
    })

    toast.add({ title: '修改成功' })
    editOpen.value = false
    resetForm()
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: '修改失败', description })
  } finally {
    updating.value = false
  }
}

function openRoleActionConfirm(type: 'delete' | 'reset', rows: RoleUser[]) {
  const actionableRows = rows.filter(row => row.role !== 'superAdmin')
  if (!actionableRows.length) {
    return
  }

  roleActionType.value = type
  roleActionIds.value = actionableRows.map(row => row.userId)
  roleActionNames.value = actionableRows.map(row => row.name)
  roleActionConfirmOpen.value = true
}

function requestDeleteSelectedUsers() {
  openRoleActionConfirm('delete', selectedActionableRows.value.map(row => row.original))
}

function requestResetSelectedUsers() {
  openRoleActionConfirm('reset', selectedActionableRows.value.map(row => row.original))
}

async function performDeleteUsers(ids: string[]) {
  for (const id of ids) {
    await $fetch(`/api/admin/roles/users/${id}`, {
      method: 'DELETE'
    })
  }
}

async function performResetPasswords(ids: string[]) {
  for (const id of ids) {
    await $fetch(`/api/admin/roles/users/${id}/password`, {
      method: 'PUT'
    })
  }
}

async function confirmRoleAction() {
  if (!roleActionIds.value.length) {
    roleActionConfirmOpen.value = false
    return
  }

  roleActionConfirmLoading.value = true
  try {
    if (roleActionType.value === 'delete') {
      await performDeleteUsers(roleActionIds.value)
      toast.add({ title: roleActionIds.value.length > 1 ? `已批量删除 ${roleActionIds.value.length} 名用户` : '删除成功' })
    } else {
      await performResetPasswords(roleActionIds.value)
      toast.add({ title: roleActionIds.value.length > 1 ? `已批量重置 ${roleActionIds.value.length} 名用户密码` : '重置密码成功' })
    }

    roleActionConfirmOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: roleActionType.value === 'delete' ? '删除失败' : '重置密码失败', description })
  } finally {
    roleActionConfirmLoading.value = false
  }
}

async function resetPassword() {
  if (!editingId.value || isEditingSuperAdmin.value) {
    return
  }

  resetting.value = true
  try {
    await $fetch(`/api/admin/roles/users/${editingId.value}/password`, {
      method: 'PUT'
    })

    toast.add({ title: `已重置 ${editingId.value} 的密码` })
    roleFormOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: '重置密码失败', description })
  } finally {
    resetting.value = false
  }
}

async function submitRoleForm() {
  if (isEditingMode.value) {
    await updateUser()
    return
  }

  await createUser()
}
</script>

<template>
  <UDashboardPanel id="admin-roles">
    <template #header>
      <UDashboardNavbar title="角色管理">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <NavbarActions />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <UInput
            v-model="keyword"
            icon="i-lucide-search"
            placeholder="搜索用户名/学号"
            class="max-w-sm"
          />

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="isAdmin && selectedActionableCount > 0"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              @click="requestDeleteSelectedUsers"
            >
              删除
              <template #trailing>
                <UKbd>
                  {{ selectedActionableCount }}
                </UKbd>
              </template>
            </UButton>

            <UButton
              v-if="isAdmin && selectedActionableCount > 0"
              color="primary"
              variant="subtle"
              icon="i-lucide-key-round"
              @click="requestResetSelectedUsers"
            >
              重置密码
              <template #trailing>
                <UKbd>
                  {{ selectedActionableCount }}
                </UKbd>
              </template>
            </UButton>

            <UButton
              v-if="isAdmin"
              icon="i-lucide-user-round-plus"
              color="primary"
              @click="openCreate"
            >
              添加角色
            </UButton>
          </div>
        </div>

        <UTable
          ref="tableRef"
          v-model:column-filters="columnFilters"
          v-model:column-visibility="columnVisibility"
          v-model:sorting="sorting"
          v-model:row-selection="rowSelection"
          v-model:pagination="pagination"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :loading="status === 'pending'"
          :data="usersData"
          :columns="columns"
          sticky
          class="w-full"
        />

        <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            {{ selectedActionableCount }} / {{ tableRef?.tableApi?.getFilteredRowModel().rows.length || 0 }} 已选择
          </div>
          <UPagination
            :default-page="(tableRef?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="tableRef?.tableApi?.getState().pagination.pageSize"
            :total="tableRef?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="p => tableRef?.tableApi?.setPageIndex(p - 1)"
          />
        </div>

        <UModal v-model:open="roleFormOpen" :title="roleFormTitle" :ui="{ content: 'max-w-2xl' }">
          <template #body>
            <UForm
              :id="roleFormId"
              :state="formState"
              :validate="validateForm"
              :validate-on="['input', 'blur', 'change']"
              class="grid grid-cols-1 md:grid-cols-2 gap-4"
              @submit="submitRoleForm"
            >
              <UFormField name="role" label="角色">
                <USelect
                  v-model="formState.role"
                  :items="roleItems"
                  :disabled="isEditingSuperAdmin"
                  class="w-full"
                />
              </UFormField>

              <UFormField name="userId" :label="userIdLabel">
                <UInput
                  :model-value="formState.userId"
                  :placeholder="formState.role === 'admin' ? '请输入用户名' : '请输入学号'"
                  :disabled="isEditingSuperAdmin"
                  maxlength="20"
                  class="w-full"
                  @update:model-value="updateFormUserId"
                />
                <p v-if="isCreatingClassLeader && classLeaderLookupMessage" class="text-xs text-muted mt-1">
                  {{ classLeaderLookupMessage }}
                </p>
              </UFormField>

              <UFormField name="name" label="姓名">
                <UInput
                  :model-value="formState.name"
                  :placeholder="isCreatingClassLeader ? '将根据学号自动填充' : '请输入姓名'"
                  :loading="isCreatingClassLeader && classLeaderLookupLoading"
                  :disabled="isCreatingClassLeader || isEditingSuperAdmin || (isEditingMode && editingRole === 'classLeader')"
                  maxlength="10"
                  class="w-full"
                  @update:model-value="updateFormName"
                />
              </UFormField>

              <UFormField v-if="!isAdminType || isEditingSuperAdmin" name="className" label="班级">
                <UInput
                  :model-value="formState.className"
                  :placeholder="isCreatingClassLeader ? '将根据学号自动填充' : '请输入班级'"
                  :loading="isCreatingClassLeader && classLeaderLookupLoading"
                  :disabled="isCreatingClassLeader || isEditingSuperAdmin || (isEditingMode && editingRole === 'classLeader')"
                  maxlength="20"
                  class="w-full"
                  @update:model-value="updateFormClassName"
                />
              </UFormField>

              <UFormField v-if="showAdminPasswordInput" name="password" label="密码">
                <UInput
                  v-model="formState.password"
                  type="password"
                  placeholder="请输入密码"
                  class="w-full"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer>
            <div class="flex justify-between gap-2 w-full">
              <div>
                <UButton
                  v-if="isEditingMode && !isEditingSuperAdmin"
                  color="primary"
                  variant="subtle"
                  :loading="resetting"
                  @click="resetPassword"
                >
                  重置密码
                </UButton>
              </div>
              <div class="flex justify-end gap-2">
                <UButton color="neutral" variant="ghost" @click="roleFormOpen = false">
                  取消
                </UButton>
                <UButton type="submit" :form="roleFormId" :loading="roleFormLoading">
                  {{ roleFormSubmitText }}
                </UButton>
              </div>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="roleActionConfirmOpen" :title="roleActionConfirmTitle">
          <template #body>
            <p class="text-sm text-muted">
              {{ roleActionConfirmDescription }}
            </p>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="roleActionConfirmLoading"
                @click="roleActionConfirmOpen = false"
              >
                取消
              </UButton>
              <UButton
                :color="roleActionType === 'delete' ? 'error' : 'primary'"
                :loading="roleActionConfirmLoading"
                @click="confirmRoleAction"
              >
                确认
              </UButton>
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
