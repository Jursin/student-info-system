<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import { getPaginationRowModel, type Row, type SortingState } from '@tanstack/table-core'

import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { DynamicTable } from '~/types'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { buildSortableHeader } from '~/utils/table'

type TableRow = {
  id: string
  name: string
  createdBy: string
  fieldCount: number
  fieldsLabel: string
}

type FieldRow = {
  key: string
  label: string
  type: 'text' | 'number' | 'chinese' | 'date' | 'singleChoice'
  limit?: number
  options?: string[]
}

const BASIC_INFO_TABLE_ID = 'basic-info'
const BASIC_INFO_LOCKED_FIELD_KEYS = ['userId', 'name', 'gender', 'className']
const SHARED_LOCKED_FIELD_KEYS = ['userId', 'name']

const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

type TablesListApiRef = {
  getFilteredSelectedRowModel: () => { rows: Array<{ original: TableRow }> }
  getFilteredRowModel: () => { rows: Array<{ original: TableRow }> }
  getState: () => { pagination: { pageIndex: number, pageSize: number } }
  setPageIndex: (pageIndex: number) => void
}

const toast = useToast()
const { isAdmin } = useRole()
const router = useRouter()
const tableRef = ref<{ tableApi?: TablesListApiRef } | null>(null)
const pollTimer = ref<number | null>(null)
const tableSorting = ref<SortingState>([])
const createFieldSorting = ref<SortingState>([])
const editFieldSorting = ref<SortingState>([])
const searchKeyword = ref('')

const { data: tables, status, refresh } = await useFetch<DynamicTable[]>('/api/tables', {
  default: () => []
})

const createOpen = ref(false)
const editOpen = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const deletingIds = ref<string[]>([])
const submitting = ref(false)
const deleteConfirmOpen = ref(false)
const deleteConfirmLoading = ref(false)
const deleteConfirmIds = ref<string[]>([])

const designerState = reactive({
  tableName: '',
  tableType: 'partial' as 'full' | 'partial',
  fieldLabel: '',
  fieldType: 'text' as 'text' | 'number' | 'chinese' | 'date' | 'singleChoice',
  fieldLimit: undefined as number | undefined,
  fieldOptions: [] as string[]
})

const fields = ref<FieldRow[]>([])

function createDefaultSharedFields(): FieldRow[] {
  return [
    { key: 'userId', label: '学号', type: 'number' },
    { key: 'name', label: '姓名', type: 'chinese' }
  ]
}

const tableRows = computed<TableRow[]>(() => tables.value.map(item => ({
  id: item.id,
  name: item.name,
  createdBy: item.createdBy,
  fieldCount: item.fields.length,
  fieldsLabel: item.fields.map(field => field.label).join('、')
})))

const filteredTableRows = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return tableRows.value
  }

  return tableRows.value.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(keyword)))
})

const typeMap: Record<string, string> = {
  text: '文本',
  number: '纯数字',
  chinese: '纯汉字',
  date: '日期',
  singleChoice: '单选'
}

function removeField(index: number) {
  fields.value.splice(index, 1)
}

function canDeleteField(field: FieldRow) {
  if (!isEditing.value && SHARED_LOCKED_FIELD_KEYS.includes(field.key)) {
    return false
  }

  if (editingId.value !== BASIC_INFO_TABLE_ID) {
    return true
  }

  return !BASIC_INFO_LOCKED_FIELD_KEYS.includes(field.key)
}

const fieldColumns: TableColumn<FieldRow>[] = [
  {
    id: 'drag',
    header: '',
    meta: {
      class: {
        th: 'w-10',
        td: 'w-10'
      }
    },
    cell: () => h('span', {
      class: 'field-drag-handle inline-flex cursor-grab select-none text-muted'
    }, '⋮⋮')
  },
  {
    accessorKey: 'label',
    header: ({ column }) => buildSortableHeader(UButton, column, '字段名')
  },
  {
    accessorKey: 'type',
    header: ({ column }) => buildSortableHeader(UButton, column, '字段类型'),
    cell: ({ row }) => typeMap[row.original.type] || row.original.type
  },
  {
    accessorKey: 'limit',
    header: ({ column }) => buildSortableHeader(UButton, column, '位数限制'),
    cell: ({ row }) => {
      const field = row.original
      if (field.type === 'singleChoice' || field.type === 'date') {
        return '-'
      }

      return field.limit ?? '-'
    }
  },
  {
    id: 'delete',
    header: '',
    meta: {
      class: {
        th: 'w-10 text-right',
        td: 'w-10 text-right'
      }
    },
    cell: ({ row }) => {
      if (!canDeleteField(row.original)) {
        return null
      }

      return h(UButton, {
        icon: 'i-lucide-trash',
        color: 'error',
        variant: 'ghost',
        size: 'xs',
        onClick: () => removeField(row.index)
      })
    }
  }
]

const columnFilters = ref([{ id: 'name', value: '' }])
const columnVisibility = ref<Record<string, boolean>>({})
const rowSelection = ref({})
const pagination = ref({ pageIndex: 0, pageSize: 20 })
const createFieldsTableWrap = ref<HTMLElement | null>(null)
const editFieldsTableWrap = ref<HTMLElement | null>(null)
const fieldsSortable = ref<{ stop?: () => void } | null>(null)

function setupFieldsSortable(target: HTMLElement | null) {
  if (!import.meta.client || !target) {
    return
  }

  const tbody = target.querySelector('tbody') as HTMLElement | null
  if (!tbody) {
    return
  }

  fieldsSortable.value?.stop?.()
  fieldsSortable.value = useSortable(tbody, fields)
}

watch([createOpen, editOpen], async ([isCreateOpen, isEditOpen]) => {
  if (!isCreateOpen && !isEditOpen) {
    fieldsSortable.value?.stop?.()
    fieldsSortable.value = null
    return
  }

  await nextTick()
  setupFieldsSortable(isCreateOpen ? createFieldsTableWrap.value : editFieldsTableWrap.value)
})

watch(() => designerState.fieldType, (type) => {
  if (type === 'singleChoice' || type === 'date') {
    designerState.fieldLimit = undefined
  }
})

function validateDesignerForm(state: typeof designerState) {
  const errors: Array<{ name: string, message: string }> = []

  if (!state.tableName.trim()) {
    errors.push({ name: 'tableName', message: '请输入表名' })
  }

  return errors
}

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

function getRowItems(row: Row<TableRow>) {
  const items: DropdownMenuItem[] = []

  if (isAdmin.value) {
    items.push({
      label: '修改',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditModal(row.original.id)
    })
    if (row.original.id !== BASIC_INFO_TABLE_ID) {
      items.push({
        label: '删除',
        icon: 'i-lucide-trash',
        color: 'error',
        onSelect: () => requestDeleteTable(row.original.id)
      })
    }
  }

  return items
}

const columns: TableColumn<TableRow>[] = [
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
    accessorKey: 'name',
    header: ({ column }) => buildSortableHeader(UButton, column, '表名'),
    cell: ({ row }) => h('button', {
      class: 'text-primary hover:underline',
      onClick: () => router.push(`/tables/${row.original.id}`)
    }, row.original.name)
  },
  {
    accessorKey: 'createdBy',
    header: ({ column }) => buildSortableHeader(UButton, column, '创建者')
  },
  {
    accessorKey: 'fieldCount',
    header: ({ column }) => buildSortableHeader(UButton, column, '字段数')
  },
  {
    accessorKey: 'fieldsLabel',
    header: ({ column }) => buildSortableHeader(UButton, column, '字段')
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

function resetForm() {
  designerState.tableName = ''
  designerState.tableType = 'full'
  designerState.fieldLabel = ''
  designerState.fieldType = 'text'
  designerState.fieldLimit = undefined
  designerState.fieldOptions = []
  fields.value = []
  editingId.value = ''
  isEditing.value = false
}

function addField() {
  const label = designerState.fieldLabel.trim()
  if (!label) {
    return
  }

  fields.value.push({
    key: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    type: designerState.fieldType,
    limit: designerState.fieldLimit,
    options: designerState.fieldType === 'singleChoice'
      ? designerState.fieldOptions.map(item => item.trim()).filter(Boolean)
      : undefined
  })

  designerState.fieldLabel = ''
  designerState.fieldType = 'text'
  designerState.fieldLimit = undefined
  designerState.fieldOptions = []
}

function openCreateModal() {
  resetForm()
  fields.value = createDefaultSharedFields()
  createOpen.value = true
}

function openEditModal(id: string) {
  const current = tables.value.find(item => item.id === id)
  if (!current) {
    return
  }

  resetForm()
  isEditing.value = true
  editingId.value = id
  designerState.tableName = current.name
  fields.value = current.fields
    .map(field => ({
      key: field.key,
      label: field.label,
      type: field.type,
      limit: field.limit,
      options: field.options
    }))
  editOpen.value = true
}

async function submitTable() {
  if (!isAdmin.value) {
    return
  }

  submitting.value = true
  try {
    if (isEditing.value && editingId.value) {
      await $fetch(`/api/admin/tables/${editingId.value}`, {
        method: 'PUT',
        body: {
          name: designerState.tableName,
          fields: fields.value
        }
      })
      toast.add({ title: '表修改成功' })
      editOpen.value = false
    } else {
      await $fetch('/api/admin/tables', {
        method: 'POST',
        body: {
          name: designerState.tableName,
          tableType: designerState.tableType,
          fields: fields.value
        }
      })
      toast.add({ title: '新表创建成功' })
      createOpen.value = false
    }

    resetForm()
    await refresh()
    await refreshNuxtData('/api/tables')
    window.location.reload()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({
      color: 'error',
      title: isEditing.value ? '修改失败' : '创建失败',
      description
    })
  } finally {
    submitting.value = false
  }
}

// 请求删除表 - 打开确认弹窗
function requestDeleteTable(id: string) {
  deleteConfirmIds.value = [id]
  deleteConfirmOpen.value = true
}

// 请求批量删除表 - 打开确认弹窗
function requestDeleteSelectedTables() {
  const selectedRows = tableRef.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  const ids = selectedRows
    .map(row => row.original.id)
    .filter((id: string) => id !== BASIC_INFO_TABLE_ID)
  if (!ids.length) {
    return
  }

  deleteConfirmIds.value = ids
  deleteConfirmOpen.value = true
}

// 执行删除表
async function performDeleteTable(id: string) {
  if (!isAdmin.value) {
    return
  }

  deletingIds.value.push(id)
  try {
    await $fetch(`/api/admin/tables/${id}`, { method: 'DELETE' })
    toast.add({ title: `已删除表 ${id}` })
    await refresh()
    await refreshNuxtData('/api/tables')
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({ color: 'error', title: '删除失败', description })
  } finally {
    deletingIds.value = deletingIds.value.filter(item => item !== id)
  }
}

// 执行删除多个表
async function performDeleteTables(ids: string[]) {
  if (!isAdmin.value) {
    return
  }

  for (const id of ids) {
    await performDeleteTable(id)
  }

  await refresh()
  await refreshNuxtData('/api/tables')
  window.location.reload()
}

// 确认删除 - 从弹窗中调用
async function confirmDeleteTable() {
  deleteConfirmLoading.value = true
  try {
    await performDeleteTables(deleteConfirmIds.value)
    deleteConfirmOpen.value = false
  } finally {
    deleteConfirmLoading.value = false
  }
}

onMounted(() => {
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  fieldsSortable.value?.stop?.()
})
</script>

<template>
  <UDashboardPanel id="tables-overview">
    <template #header>
      <UDashboardNavbar title="信息表">
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

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="isAdmin && (tableRef?.tableApi?.getFilteredSelectedRowModel().rows.length || 0) > 0"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              @click="requestDeleteSelectedTables"
            >
              批量删除
              <template #trailing>
                <UKbd>
                  {{ tableRef?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }}
                </UKbd>
              </template>
            </UButton>

            <UButton
              v-if="isAdmin"
              icon="i-lucide-grid-2x2-plus"
              color="primary"
              @click="openCreateModal"
            >
              新建
            </UButton>
          </div>
        </div>

        <UTable
          ref="tableRef"
          v-model:column-filters="columnFilters"
          v-model:column-visibility="columnVisibility"
          v-model:sorting="tableSorting"
          v-model:row-selection="rowSelection"
          v-model:pagination="pagination"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :data="filteredTableRows"
          :columns="columns"
          :loading="status === 'pending'"
          sticky
          class="w-full"
        />

        <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            {{ tableRef?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} / {{ tableRef?.tableApi?.getFilteredRowModel().rows.length || 0 }} 已选择
          </div>
          <UPagination
            :default-page="(tableRef?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="tableRef?.tableApi?.getState().pagination.pageSize"
            :total="tableRef?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="p => tableRef?.tableApi?.setPageIndex(p - 1)"
          />
        </div>

        <UModal v-model:open="createOpen" title="新建信息表" :ui="{ content: 'max-w-4xl' }">
          <template #body>
            <UForm
              id="create-table-form"
              :state="designerState"
              :validate="validateDesignerForm"
              :validate-on="['input', 'blur', 'change']"
              class="space-y-4"
              @submit="submitTable"
            >
              <div class="flex flex-wrap gap-4">
                <UFormField name="tableName" label="表名" class="w-full md:w-60">
                  <UInput v-model="designerState.tableName" placeholder="请输入表名" class="w-full" />
                </UFormField>

                <UFormField name="tableType" label="表类型" class="w-22">
                  <USelect
                    v-model="designerState.tableType"
                    :items="[
                      { label: '全员表', value: 'full' },
                      { label: '部分表', value: 'partial' }
                    ]"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <div class="flex flex-wrap items-end gap-4">
                <UFormField label="字段名" class="w-30">
                  <UInput v-model="designerState.fieldLabel" placeholder="请输入字段名" class="w-full" />
                </UFormField>

                <UFormField label="字段类型" class="w-22">
                  <USelect
                    v-model="designerState.fieldType"
                    :items="[
                      { label: '文本', value: 'text' },
                      { label: '纯数字', value: 'number' },
                      { label: '纯汉字', value: 'chinese' },
                      { label: '日期', value: 'date' },
                      { label: '单选', value: 'singleChoice' }
                    ]"
                    class="w-full"
                  />
                </UFormField>

                <UFormField v-if="designerState.fieldType !== 'singleChoice' && designerState.fieldType !== 'date'" label="位数限制" class="w-20">
                  <UInput
                    v-model.number="designerState.fieldLimit"
                    type="number"
                    placeholder="可选"
                    class="w-full"
                  />
                </UFormField>

                <UButton
                  type="button"
                  variant="outline"
                  icon="i-lucide-plus"
                  class="w-auto h-8"
                  @click="addField"
                >
                  添加字段
                </UButton>
              </div>

              <UFormField v-if="designerState.fieldType === 'singleChoice'" label="单选项" class="w-full">
                <UInputTags v-model="designerState.fieldOptions" placeholder="输入后回车添加选项" class="w-full" />
              </UFormField>

              <div ref="createFieldsTableWrap">
                <UTable v-model:sorting="createFieldSorting" :data="fields" :columns="fieldColumns" />
              </div>
            </UForm>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton color="neutral" variant="ghost" @click="createOpen = false">
                取消
              </UButton>
              <UButton type="submit" form="create-table-form" :loading="submitting">
                创建
              </UButton>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="editOpen" title="修改信息表" :ui="{ content: 'max-w-4xl' }">
          <template #body>
            <UForm
              id="edit-table-form"
              :state="designerState"
              :validate="validateDesignerForm"
              :validate-on="['input', 'blur', 'change']"
              class="space-y-4"
              @submit="submitTable"
            >
              <UFormField name="tableName" label="表名" class="w-full md:w-60">
                <UInput v-model="designerState.tableName" placeholder="请输入新表名" class="w-full" />
              </UFormField>

              <div class="flex flex-wrap items-end gap-4">
                <UFormField label="字段名" class="w-30">
                  <UInput v-model="designerState.fieldLabel" placeholder="请输入字段名" class="w-full" />
                </UFormField>

                <UFormField label="字段类型" class="w-22">
                  <USelect
                    v-model="designerState.fieldType"
                    :items="[
                      { label: '文本', value: 'text' },
                      { label: '纯数字', value: 'number' },
                      { label: '纯汉字', value: 'chinese' },
                      { label: '日期', value: 'date' },
                      { label: '单选', value: 'singleChoice' }
                    ]"
                    class="w-full"
                  />
                </UFormField>

                <UFormField v-if="designerState.fieldType !== 'singleChoice' && designerState.fieldType !== 'date'" label="位数限制" class="w-22">
                  <UInput
                    v-model.number="designerState.fieldLimit"
                    type="number"
                    placeholder="可选"
                    class="w-full"
                  />
                </UFormField>

                <UButton
                  type="button"
                  variant="outline"
                  icon="i-lucide-plus"
                  class="w-auto"
                  @click="addField"
                >
                  添加字段
                </UButton>
              </div>

              <UFormField v-if="designerState.fieldType === 'singleChoice'" label="单选项" class="w-full">
                <UInputTags v-model="designerState.fieldOptions" placeholder="输入后回车添加选项" class="w-full" />
              </UFormField>

              <div ref="editFieldsTableWrap">
                <UTable v-model:sorting="editFieldSorting" :data="fields" :columns="fieldColumns" />
              </div>
            </UForm>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton color="neutral" variant="ghost" @click="editOpen = false">
                取消
              </UButton>
              <UButton type="submit" form="edit-table-form" :loading="submitting">
                保存修改
              </UButton>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="deleteConfirmOpen" title="确认删除">
          <template #body>
            <p class="text-sm text-muted">
              {{ deleteConfirmIds.length > 1 ? `即将删除 ${deleteConfirmIds.length} 个表，删除后不可恢复，是否继续？` : `即将删除表 ${deleteConfirmIds[0] || ''}，删除后不可恢复，是否继续？` }}
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
                @click="confirmDeleteTable"
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
