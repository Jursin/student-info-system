<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables/useToast'
import { getPaginationRowModel, type Row, type SortingState } from '@tanstack/table-core'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { DynamicTable } from '~/types'
import { fromDateValue, toDateValue } from '~/utils/date'
import { buildSortableHeader } from '~/utils/table'

const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

type RowRecord = Record<string, string>
type TableColumnApi = {
  id: string
  getCanHide: () => boolean
  getIsVisible: () => boolean
}
type TableApiRef = {
  getAllColumns: () => TableColumnApi[]
  getColumn: (id: string) => { toggleVisibility: (visible: boolean) => void } | undefined
  getFilteredSelectedRowModel: () => { rows: Array<{ original: RowRecord }> }
  getFilteredRowModel: () => { rows: Array<{ original: RowRecord }> }
  getState: () => { pagination: { pageIndex: number, pageSize: number } }
  setPageIndex: (pageIndex: number) => void
}

const toast = useToast()
const { isAdmin } = useRole()
const route = useRoute()
const table = ref<{ tableApi?: TableApiRef } | null>(null)
const pollTimer = ref<number | null>(null)

const addOpen = ref(false)
const editOpen = ref(false)
const submitting = ref(false)
const deletingIds = ref<string[]>([])
const editingUserId = ref('')
const formState = ref<Record<string, string>>({})
const actionConfirmOpen = ref(false)
const actionConfirmLoading = ref(false)
const actionConfirmType = ref<'delete' | 'reset'>('delete')
const actionConfirmIds = ref<string[]>([])

const tableId = computed(() => route.params.id as string)
type TableDetailResponse = { table: DynamicTable, rows: Record<string, string>[] }

const defaultTableDetail: TableDetailResponse = {
  table: {
    id: '',
    name: '',
    createdBy: '',
    type: 'partial',
    fields: []
  },
  rows: []
}

const { data, status, refresh } = await useFetch<TableDetailResponse>(
  () => `/api/tables/${tableId.value}`,
  {
    default: () => defaultTableDetail,
    watch: [tableId]
  }
)

const tableData = computed<TableDetailResponse>(() => data.value ?? defaultTableDetail)

const columnFilters = ref([{ id: 'userId', value: '' }])
const columnVisibility = ref<Record<string, boolean>>({})
const sorting = ref<SortingState>([])
const rowSelection = ref({})
const pagination = ref({ pageIndex: 0, pageSize: 20 })
const searchKeyword = ref('')

const hasUserIdField = computed(() => tableData.value.table.fields.some(field => field.key === 'userId'))
const hasNameField = computed(() => tableData.value.table.fields.some(field => field.key === 'name'))

function validateStudentForm(state: Record<string, string>) {
  const errors: Array<{ name: string, message: string }> = []
  const userId = String(state.userId ?? '').trim()
  const name = String(state.name ?? '').trim()

  if (hasUserIdField.value && !userId) {
    errors.push({ name: 'userId', message: '请输入学号' })
  }

  if (hasNameField.value && !name) {
    errors.push({ name: 'name', message: '请输入姓名' })
  }

  return errors
}

const displayColumnItems = computed(() => {
  const tableApi = table.value?.tableApi
  if (!tableApi) {
    return []
  }

  const labelMap = Object.fromEntries(tableData.value.table.fields
    .filter(field => field.key !== 'password')
    .map(field => [field.key, field.label]))

  return tableApi
    .getAllColumns()
    .filter(column => column.getCanHide() && !['select', 'actions'].includes(column.id))
    .map(column => ({
      label: labelMap[column.id] || column.id,
      type: 'checkbox',
      checked: column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        tableApi.getColumn(column.id)?.toggleVisibility(!!checked)
      },
      onSelect(e?: Event) {
        e?.preventDefault()
      }
    }))
})

const filteredRows = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return tableData.value.rows
  }

  return tableData.value.rows.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(keyword)))
})

const isBasicInfoTable = computed(() => tableId.value === 'basic-info')
const tableTypeLabel = computed(() => tableData.value.table.type === 'full' ? '全员表' : '部分表')
const selectedCount = computed(() => table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0)

const actionConfirmTitle = computed(() => actionConfirmType.value === 'delete' ? '确认删除' : '确认重置密码')
const actionConfirmDescription = computed(() => {
  const count = actionConfirmIds.value.length
  if (actionConfirmType.value === 'delete') {
    return count > 1
      ? `即将删除 ${count} 名学生，删除后不可恢复，是否继续？`
      : `即将删除学生 ${actionConfirmIds.value[0] || ''}，删除后不可恢复，是否继续？`
  }

  return count > 1
    ? `即将重置 ${count} 名学生的密码为默认值 Stu1234567，是否继续？`
    : `即将重置学生 ${actionConfirmIds.value[0] || ''} 的密码为默认值 Stu1234567，是否继续？`
})

function createEmptyFormState() {
  return Object.fromEntries(tableData.value.table.fields.map(field => [field.key, '']))
}

function toStudentPayload(row: Record<string, string>) {
  const userId = String(row.userId ?? '').trim()
  const name = String(row.name ?? '').trim()
  const className = String(row.className ?? '').trim()

  return {
    userId,
    name,
    className,
    gender: String(row.gender ?? ''),
    birthDate: String(row.birthDate ?? ''),
    phone: String(row.phone ?? ''),
    address: String(row.address ?? ''),
    guardianPhone: String(row.guardianPhone ?? ''),
    major: String(row.major ?? '')
  }
}

function openAddModal() {
  formState.value = createEmptyFormState()
  addOpen.value = true
}

function openEditModal(row: Record<string, string>) {
  formState.value = createEmptyFormState()
  for (const field of tableData.value.table.fields) {
    formState.value[field.key] = row[field.key] || ''
  }
  editingUserId.value = row.userId || ''
  editOpen.value = true
}

const formPanelOpen = computed({
  get: () => addOpen.value || editOpen.value,
  set: (value: boolean) => {
    if (!value) {
      addOpen.value = false
      editOpen.value = false
    }
  }
})

const isEditingForm = computed(() => editOpen.value)
const formPanelTitle = computed(() => isEditingForm.value ? '修改信息' : '添加信息')
const formPanelId = computed(() => isEditingForm.value ? 'edit-row-form' : 'add-row-form')
const isCoreField = (key: string) => ['userId', 'name'].includes(key)
const isFieldReadonlyInEdit = (key: string) => isEditingForm.value && !isBasicInfoTable.value && isCoreField(key)

async function submitFormPanel() {
  if (!isEditingForm.value && (!hasUserIdField.value || !hasNameField.value)) {
    toast.add({
      color: 'error',
      title: '添加失败',
      description: '当前信息表缺少学号或姓名字段，无法新增学生信息'
    })
    return
  }

  if (isEditingForm.value) {
    await updateRow()
    return
  }

  await addRow()
}

async function addRow() {
  if (!isAdmin.value) {
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/students', {
      method: 'POST',
      body: {
        ...toStudentPayload(formState.value),
        tableId: tableId.value
      }
    })
    toast.add({ title: '添加成功' })
    addOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '添加失败', description })
  } finally {
    submitting.value = false
  }
}

async function updateRow() {
  if (!isAdmin.value || !editingUserId.value) {
    return
  }

  submitting.value = true
  try {
    await $fetch(`/api/students/${editingUserId.value}`, {
      method: 'PUT',
      body: {
        ...toStudentPayload(formState.value),
        tableId: tableId.value
      }
    })
    toast.add({ title: '修改成功' })
    editOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '修改失败', description })
  } finally {
    submitting.value = false
  }
}

function openActionConfirm(type: 'delete' | 'reset', ids: string[]) {
  if (!ids.length) {
    return
  }

  actionConfirmType.value = type
  actionConfirmIds.value = ids
  actionConfirmOpen.value = true
}

async function performDeleteRows(ids: string[]) {
  if (!isAdmin.value || !ids.length) {
    return
  }

  submitting.value = true
  try {
    for (const id of ids) {
      deletingIds.value.push(id)
      await $fetch(`/api/students/${id}`, { method: 'DELETE' })
      deletingIds.value = deletingIds.value.filter(item => item !== id)
    }

    if (ids.length > 1) {
      toast.add({ title: `已批量删除 ${ids.length} 名学生` })
    } else {
      toast.add({ title: `已删除 ${ids[0] || ''}` })
    }

    await refresh()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '删除失败', description })
  } finally {
    deletingIds.value = []
    submitting.value = false
  }
}

async function performResetPasswords(ids: string[]) {
  if (!isAdmin.value || !isBasicInfoTable.value || !ids.length) {
    return
  }

  submitting.value = true
  try {
    for (const id of ids) {
      await $fetch(`/api/students/${id}/password`, {
        method: 'PUT'
      })
    }

    if (ids.length > 1) {
      toast.add({ title: `已批量重置 ${ids.length} 名学生密码为默认值 Stu1234567` })
    } else {
      toast.add({ title: `已重置 ${ids[0] || ''} 的密码为默认值 Stu1234567` })
    }

    editOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '重置密码失败', description })
  } finally {
    submitting.value = false
  }
}

function requestDeleteRows(ids: string[]) {
  if (!isAdmin.value) {
    return
  }

  openActionConfirm('delete', ids)
}

function requestDeleteSelectedRows() {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  const ids = selectedRows
    .map(row => row.original.userId)
    .filter((id): id is string => Boolean(id))

  requestDeleteRows(ids)
}

function requestResetPassword() {
  if (!isAdmin.value || !editingUserId.value || !isBasicInfoTable.value) {
    return
  }

  openActionConfirm('reset', [editingUserId.value])
}

function requestResetSelectedPasswords() {
  if (!isAdmin.value || !isBasicInfoTable.value) {
    return
  }

  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  const ids = selectedRows
    .map(row => row.original.userId)
    .filter((id): id is string => Boolean(id))

  openActionConfirm('reset', ids)
}

async function confirmAction() {
  if (!actionConfirmIds.value.length) {
    actionConfirmOpen.value = false
    return
  }

  actionConfirmLoading.value = true
  try {
    if (actionConfirmType.value === 'delete') {
      await performDeleteRows(actionConfirmIds.value)
    } else {
      await performResetPasswords(actionConfirmIds.value)
    }

    actionConfirmOpen.value = false
  } finally {
    actionConfirmLoading.value = false
  }
}

async function deleteRow(userId: string) {
  requestDeleteRows([userId])
}

async function deleteSelectedRows() {
  requestDeleteSelectedRows()
}

async function resetPassword() {
  requestResetPassword()
}

async function resetSelectedPasswords() {
  requestResetSelectedPasswords()
}

function getRowItems(row: Row<RowRecord>) {
  const items: DropdownMenuItem[] = []

  if (isAdmin.value) {
    items.push({
      label: '修改',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditModal(row.original)
    })
    items.push({
      label: '删除',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect: () => deleteRow(row.original.userId || '')
    })
  }

  return items
}

const columns = computed<TableColumn<RowRecord>[]>(() => {
  const fieldColumns = tableData.value.table.fields
    .filter(field => field.key !== 'password')
    .map(field => ({
      accessorKey: field.key,
      header: ({ column }: { column: { getIsSorted: () => 'asc' | 'desc' | false, toggleSorting: (desc?: boolean) => void } }) => buildSortableHeader(UButton, column, field.label)
    }))

  return [
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
    ...fieldColumns,
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
      cell: ({ row }) => h('div', { class: 'text-right' }, h(UDropdownMenu, {
        items: getRowItems(row),
        content: { align: 'end' }
      }, () => h(UButton, {
        icon: 'i-lucide-ellipsis-vertical',
        color: 'neutral',
        variant: 'ghost'
      })))
    }
  ]
})

function startPolling() {
  if (pollTimer.value !== null) {
    return
  }

  pollTimer.value = window.setInterval(() => {
    refresh()
  }, 5000)
}

function stopPolling() {
  if (pollTimer.value !== null) {
    window.clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

onMounted(() => {
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <UDashboardPanel id="table-detail">
    <template #header>
      <UDashboardNavbar :title="tableData.table.name || '表详情'">
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
            v-model="searchKeyword"
            icon="i-lucide-search"
            placeholder="搜索所有字段"
            class="max-w-sm"
          />

          <div class="flex items-center gap-2">
            <UBadge
              v-if="!isBasicInfoTable"
              icon="i-lucide-chart-bar"
              size="lg"
              color="primary"
              variant="subtle"
            >
              {{ tableTypeLabel }}
            </UBadge>

            <UButton
              v-if="isAdmin && selectedCount > 0"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              @click="deleteSelectedRows"
            >
              删除
              <template #trailing>
                <UKbd>
                  {{ selectedCount }}
                </UKbd>
              </template>
            </UButton>

            <UButton
              v-if="isAdmin && isBasicInfoTable && selectedCount > 0"
              color="primary"
              variant="subtle"
              icon="i-lucide-key-round"
              :loading="submitting"
              @click="resetSelectedPasswords"
            >
              批量重置密码
              <template #trailing>
                <UKbd>
                  {{ selectedCount }}
                </UKbd>
              </template>
            </UButton>

            <UDropdownMenu :items="displayColumnItems" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-settings-2"
                label="展示"
                color="neutral"
                variant="outline"
              />
            </UDropdownMenu>

            <UButton
              v-if="isAdmin"
              icon="i-lucide-list-plus"
              color="primary"
              @click="openAddModal"
            >
              添加信息
            </UButton>
          </div>
        </div>

        <UTable
          ref="table"
          v-model:column-filters="columnFilters"
          v-model:column-visibility="columnVisibility"
          v-model:sorting="sorting"
          v-model:row-selection="rowSelection"
          v-model:pagination="pagination"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :loading="status === 'pending'"
          :data="filteredRows"
          :columns="columns"
          sticky
          class="w-full"
        />

        <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} / {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} 已选择
          </div>
          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="table?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="p => table?.tableApi?.setPageIndex(p - 1)"
          />
        </div>

        <UModal v-model:open="formPanelOpen" :title="formPanelTitle" :ui="{ content: 'max-w-3xl' }">
          <template #body>
            <UForm
              :id="formPanelId"
              :state="formState"
              :validate="validateStudentForm"
              :validate-on="['input', 'blur', 'change']"
              class="grid grid-cols-1 lg:grid-cols-3 gap-4"
              @submit="submitFormPanel"
            >
              <UFormField
                v-for="field in tableData.table.fields.filter(f => f.key !== 'password')"
                :key="field.key"
                :name="field.key"
                :label="field.label"
                :required="isCoreField(field.key)"
              >
                <USelect
                  v-if="field.type === 'singleChoice'"
                  v-model="formState[field.key]"
                  :items="(field.options || []).map(option => ({ label: option, value: option }))"
                  :disabled="isFieldReadonlyInEdit(field.key)"
                  class="w-full"
                />
                <UInputDate
                  v-else-if="field.type === 'date'"
                  class="w-full"
                  icon="i-lucide-calendar"
                  :model-value="toDateValue(formState[field.key])"
                  :disabled="isFieldReadonlyInEdit(field.key)"
                  @update:model-value="value => formState[field.key] = fromDateValue(value as { year: number, month: number, day: number } | null)"
                />
                <UInput
                  v-else-if="field.type === 'number'"
                  :model-value="formState[field.key]"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  :disabled="isFieldReadonlyInEdit(field.key)"
                  class="w-full"
                  @update:model-value="value => formState[field.key] = String(value ?? '').replace(/\D+/g, '')"
                />
                <UInput
                  v-else
                  v-model="formState[field.key]"
                  type="text"
                  :disabled="isFieldReadonlyInEdit(field.key)"
                  class="w-full"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer>
            <div class="flex justify-between w-full">
              <div>
                <UButton
                  v-if="isAdmin && isEditingForm && isBasicInfoTable"
                  color="primary"
                  variant="subtle"
                  :loading="submitting"
                  @click="resetPassword"
                >
                  重置密码
                </UButton>
              </div>
              <div class="flex justify-end gap-2">
                <UButton color="neutral" variant="ghost" @click="formPanelOpen = false">
                  取消
                </UButton>
                <UButton type="submit" :form="formPanelId" :loading="submitting">
                  保存修改
                </UButton>
              </div>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="actionConfirmOpen" :title="actionConfirmTitle">
          <template #body>
            <p class="text-sm text-muted">
              {{ actionConfirmDescription }}
            </p>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="actionConfirmLoading"
                @click="actionConfirmOpen = false"
              >
                取消
              </UButton>
              <UButton
                :color="actionConfirmType === 'delete' ? 'error' : 'primary'"
                :loading="actionConfirmLoading"
                @click="confirmAction"
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
