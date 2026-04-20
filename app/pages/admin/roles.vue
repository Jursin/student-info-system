<script setup lang="ts">
import { getPaginationRowModel } from '@tanstack/table-core'
import type { SortingState } from '@tanstack/table-core'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { UserRole } from '~/types'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
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

type RolesTableRef = {
  tableApi?: {
    getColumn: (id: string) => { setFilterValue: (value: string | undefined) => void } | undefined
    getFilteredSelectedRowModel: () => { rows: unknown[] }
    getFilteredRowModel: () => { rows: unknown[] }
    getState: () => { pagination: { pageIndex: number, pageSize: number } }
    setPageIndex: (pageIndex: number) => void
  }
}

const toast = useToast()
const { isSuperAdmin } = useRole()
const tableRef = ref<RolesTableRef | null>(null)
const createOpen = ref(false)
const editOpen = ref(false)
const creating = ref(false)
const updating = ref(false)
const resetting = ref(false)
const deletingId = ref('')
const deleteConfirmOpen = ref(false)
const deleteConfirmLoading = ref(false)
const deleteConfirmId = ref('')
const keyword = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 20 })
const columnFilters = ref([{ id: 'userId', value: '' }])
const sorting = ref<SortingState>([])
const rowSelection = ref({})

const formState = reactive({
  userId: '',
  name: '',
  className: '',
  role: 'admin' as 'admin' | 'classLeader',
  password: ''
})

const editingId = ref('')
const editingRole = ref<UserRole | null>(null)
const isEditingSuperAdmin = computed(() => editingRole.value === 'superAdmin')

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

const columns: TableColumn<RoleUser>[] = [
  {
    id: 'select',
    header: ({ table }) => h(UCheckbox, {
      'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
      'aria-label': 'Select all',
      'class': 'align-middle'
    }),
    cell: ({ row }) => h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
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
      if (!isSuperAdmin.value) {
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
const classLeaderLookupLoading = ref(false)
const classLeaderLookupMessage = ref('')
let classLeaderLookupTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, (value) => {
  const column = tableRef.value?.tableApi?.getColumn('userId')
  column?.setFilterValue(value || undefined)
})

function getRowItems(row: RoleUser): DropdownMenuItem[] {
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
      onSelect: () => requestDeleteUser(row.userId)
    })
  }

  return items
}

function resetForm() {
  formState.userId = ''
  formState.name = ''
  formState.className = ''
  formState.role = 'admin'
  formState.password = ''
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

  if (state.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(state.password)) {
    errors.push({ name: 'password', message: '密码至少10位，且包含大小写字母和数字' })
  }

  if (!editingId.value && isAdminType.value && !state.password.trim()) {
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
      password?: string
      name?: string
      className?: string
    } = {
      userId: formState.userId,
      role: formState.role
    }

    if (formState.role === 'admin') {
      body.name = formState.name
      body.className = ''
      body.password = formState.password
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
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '创建失败', description })
  } finally {
    creating.value = false
  }
}

watch(() => formState.role, (role) => {
  if (!editingId.value && role === 'classLeader') {
    formState.name = ''
    formState.className = ''
    formState.password = ''
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
    const body = isEditingSuperAdmin.value
      ? { name: formState.name }
      : {
          userId: formState.userId,
          name: formState.name,
          className: isAdminType.value ? '' : formState.className,
          role: formState.role,
          password: formState.password || undefined
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
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '修改失败', description })
  } finally {
    updating.value = false
  }
}

// 请求删除用户 - 打开确认弹窗
function requestDeleteUser(id: string) {
  deleteConfirmId.value = id
  deleteConfirmOpen.value = true
}

// 执行删除用户
async function performDeleteUser(id: string) {
  deletingId.value = id
  try {
    await $fetch(`/api/admin/roles/users/${id}`, {
      method: 'DELETE'
    })

    toast.add({ title: '删除成功' })
    await refresh()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '删除失败', description })
  } finally {
    deletingId.value = ''
  }
}

// 确认删除 - 从弹窗中调用
async function confirmDeleteUser() {
  deleteConfirmLoading.value = true
  try {
    await performDeleteUser(deleteConfirmId.value)
    deleteConfirmOpen.value = false
  } finally {
    deleteConfirmLoading.value = false
  }
}

async function resetPassword() {
  if (!editingId.value || isEditingSuperAdmin.value) {
    return
  }

  resetting.value = true
  try {
    const result = await $fetch<{ defaultPassword: string }>(`/api/admin/roles/users/${editingId.value}/password`, {
      method: 'PUT'
    })

    toast.add({ title: `已重置 ${editingId.value} 的密码为默认值 ${result.defaultPassword}` })
    editOpen.value = false
    resetForm()
    await refresh()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '重置密码失败', description })
  } finally {
    resetting.value = false
  }
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

          <UButton
            v-if="isSuperAdmin"
            icon="i-lucide-user-round-plus"
            color="primary"
            @click="openCreate"
          >
            添加角色
          </UButton>
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
            {{ tableRef?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} / {{
              tableRef?.tableApi?.getFilteredRowModel().rows.length || 0 }} 已选择
          </div>
          <UPagination
            :default-page="(tableRef?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="tableRef?.tableApi?.getState().pagination.pageSize"
            :total="tableRef?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="p => tableRef?.tableApi?.setPageIndex(p - 1)"
          />
        </div>

        <UModal v-model:open="createOpen" title="添加角色" :ui="{ content: 'max-w-2xl' }">
          <template #body>
            <UForm
              id="create-role-user-form"
              :state="formState"
              :validate="validateForm"
              :validate-on="['input', 'blur', 'change']"
              class="grid grid-cols-1 md:grid-cols-2 gap-4"
              @submit="createUser"
            >
              <UFormField name="role" label="角色">
                <USelect v-model="formState.role" :items="roleItems" class="w-full" />
              </UFormField>

              <UFormField name="userId" :label="userIdLabel">
                <UInput
                  v-model="formState.userId"
                  :placeholder="formState.role === 'admin' ? '请输入用户名' : '请输入学号'"
                  class="w-full"
                />
                <p v-if="isCreatingClassLeader && classLeaderLookupMessage" class="text-xs text-muted mt-1">
                  {{ classLeaderLookupMessage }}
                </p>
              </UFormField>

              <UFormField name="name" label="姓名">
                <UInput
                  v-model="formState.name"
                  :placeholder="isCreatingClassLeader ? '将根据学号自动填充' : '请输入姓名'"
                  :loading="isCreatingClassLeader && classLeaderLookupLoading"
                  :disabled="isCreatingClassLeader"
                  class="w-full"
                />
              </UFormField>

              <UFormField v-if="!isAdminType" name="className" label="班级">
                <UInput
                  v-model="formState.className"
                  :placeholder="isCreatingClassLeader ? '将根据学号自动填充' : '请输入班级'"
                  :loading="isCreatingClassLeader && classLeaderLookupLoading"
                  :disabled="isCreatingClassLeader"
                  class="w-full"
                />
              </UFormField>

              <UFormField v-if="isAdminType" name="password" label="密码">
                <UInput
                  v-model="formState.password"
                  type="password"
                  placeholder="至少10位且包含大小写字母和数字"
                  class="w-full"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton color="neutral" variant="ghost" @click="createOpen = false">
                取消
              </UButton>
              <UButton type="submit" form="create-role-user-form" :loading="creating">
                创建
              </UButton>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="editOpen" title="修改角色" :ui="{ content: 'max-w-2xl' }">
          <template #body>
            <UForm
              id="edit-role-user-form"
              :state="formState"
              :validate="validateForm"
              :validate-on="['input', 'blur', 'change']"
              class="grid grid-cols-1 md:grid-cols-2 gap-4"
              @submit="updateUser"
            >
              <UFormField name="name" label="姓名">
                <UInput v-model="formState.name" placeholder="请输入姓名" class="w-full" />
              </UFormField>

              <template v-if="!isEditingSuperAdmin">
                <UFormField name="role" label="角色">
                  <USelect v-model="formState.role" :items="roleItems" class="w-full" />
                </UFormField>

                <UFormField v-if="!isAdminType" name="className" label="班级">
                  <UInput v-model="formState.className" placeholder="请输入班级" class="w-full" />
                </UFormField>

                <UFormField name="userId" :label="userIdLabel">
                  <UInput
                    v-model="formState.userId"
                    :placeholder="formState.role === 'admin' ? '请输入用户名' : '请输入学号'"
                    class="w-full"
                  />
                </UFormField>

                <UFormField name="password" label="密码">
                  <UInput
                    v-model="formState.password"
                    type="password"
                    placeholder="至少10位且包含大小写字母和数字"
                    class="w-full"
                  />
                </UFormField>
              </template>
            </UForm>
          </template>

          <template #footer>
            <div class="flex justify-between gap-2 w-full">
              <div>
                <UButton
                  v-if="!isEditingSuperAdmin"
                  color="primary"
                  variant="subtle"
                  :loading="resetting"
                  @click="resetPassword"
                >
                  重置密码
                </UButton>
              </div>
              <div class="flex justify-end gap-2">
                <UButton color="neutral" variant="ghost" @click="editOpen = false">
                  取消
                </UButton>
                <UButton type="submit" form="edit-role-user-form" :loading="updating">
                  保存修改
                </UButton>
              </div>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="deleteConfirmOpen" title="确认删除">
          <template #body>
            <p class="text-sm text-muted">
              即将删除用户 {{ deleteConfirmId }}，删除后不可恢复，是否继续？
            </p>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="deleteConfirmLoading"
                @click="deleteConfirmOpen = false"
              >
                取消
              </UButton>
              <UButton
                color="error"
                :loading="deleteConfirmLoading"
                @click="confirmDeleteUser"
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
