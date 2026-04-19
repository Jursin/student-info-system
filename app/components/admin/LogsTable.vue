<script setup lang="ts">
import { getPaginationRowModel } from '@tanstack/table-core'
import type { SortingState } from '@tanstack/table-core'
import type { TableColumn } from '@nuxt/ui'
import type { OperationLog } from '~/types'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { fromDateValue, toDateValue } from '~/utils/date'
import { buildSortableHeader } from '~/utils/table'

const UButton = resolveComponent('UButton')
const action = ref('all')
const keyword = ref('')

type LogsTableApiRef = {
  getState: () => { pagination: { pageIndex: number, pageSize: number } }
  getFilteredRowModel: () => { rows: unknown[] }
  setPageIndex: (pageIndex: number) => void
}

const table = ref<{ tableApi?: LogsTableApiRef } | null>(null)
const columnVisibility = ref<Record<string, boolean>>({})
const sorting = ref<SortingState>([])
const pagination = ref({ pageIndex: 0, pageSize: 20 })
const clearOpen = ref(false)
const clearLoading = ref(false)
const pollTimer = ref<number | null>(null)
const toast = useToast()

const { data, status, refresh } = await useFetch<OperationLog[]>('/api/admin/logs', {
  query: computed(() => ({
    action: action.value === 'all' ? undefined : action.value,
    keyword: keyword.value || undefined
  })),
  default: () => []
})

const clearFormState = reactive({
  startAt: '',
  endAt: ''
})

function getDefaultClearDates() {
  const firstLog = data.value?.[0]
  if (!firstLog) {
    return {
      startAt: '',
      endAt: ''
    }
  }

  const startAt = firstLog.timestamp.slice(0, 10)
  const startDate = toDateValue(startAt)
  if (!startDate) {
    return {
      startAt,
      endAt: ''
    }
  }

  const currentYear = new Date().getFullYear()
  const endAt = `${currentYear}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`

  return {
    startAt,
    endAt
  }
}

function formatTimestampToCst(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const actionLabelMap: Record<OperationLog['action'], string> = {
  login: '登录',
  logout: '退出',
  create: '新增',
  read: '查看',
  update: '修改',
  delete: '删除'
}

const columns: TableColumn<OperationLog>[] = [
  {
    accessorKey: 'timestamp',
    header: ({ column }) => buildSortableHeader(UButton, column, '时间'),
    cell: ({ row }) => formatTimestampToCst(row.original.timestamp)
  },
  {
    accessorKey: 'operatorName',
    header: ({ column }) => buildSortableHeader(UButton, column, '操作者')
  },
  {
    accessorKey: 'action',
    header: ({ column }) => buildSortableHeader(UButton, column, '动作'),
    cell: ({ row }) => actionLabelMap[row.original.action]
  },
  {
    accessorKey: 'target',
    header: ({ column }) => buildSortableHeader(UButton, column, '目标')
  },
  {
    accessorKey: 'detail',
    header: ({ column }) => buildSortableHeader(UButton, column, '详情')
  }
]

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

watch(clearOpen, (open) => {
  if (!open) {
    return
  }

  const defaults = getDefaultClearDates()
  clearFormState.startAt = defaults.startAt
  clearFormState.endAt = defaults.endAt
})

async function clearLogs() {
  clearLoading.value = true
  try {
    await $fetch('/api/admin/logs', {
      method: 'DELETE',
      body: {
        startAt: clearFormState.startAt || undefined,
        endAt: clearFormState.endAt || undefined
      }
    })
    toast.add({ title: '日志清除成功' })
    clearOpen.value = false
    clearFormState.startAt = ''
    clearFormState.endAt = ''
    await refresh()
  } catch (error: unknown) {
    const description = (error as { data?: { message?: string } })?.data?.message || '请稍后重试'
    toast.add({
      color: 'error',
      title: '清除失败',
      description
    })
  } finally {
    clearLoading.value = false
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
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="keyword"
          icon="i-lucide-search"
          placeholder="搜索操作者、动作或目标"
          class="w-64"
        />
      </div>

      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          @click="clearOpen = true"
        >
          清除日志
        </UButton>
      </div>
    </div>

    <UTable
      ref="table"
      v-model:column-visibility="columnVisibility"
      v-model:sorting="sorting"
      v-model:pagination="pagination"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      :loading="status === 'pending'"
      :data="data"
      :columns="columns"
      sticky
      class="w-full"
    />

    <div class="flex items-center justify-end gap-3 border-t border-default pt-4">
      <UPagination
        :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
        :items-per-page="table?.tableApi?.getState().pagination.pageSize"
        :total="table?.tableApi?.getFilteredRowModel().rows.length"
        @update:page="p => table?.tableApi?.setPageIndex(p - 1)"
      />
    </div>

    <UModal v-model:open="clearOpen" title="清除操作日志">
      <template #body>
        <UForm
          id="clear-log-form"
          :state="clearFormState"
          :validate-on="['change']"
          class="space-y-3"
          @submit="clearLogs"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UFormField name="startAt" label="开始日期">
              <UInputDate
                :model-value="toDateValue(clearFormState.startAt)"
                locale="zh-CN"
                icon="i-lucide-calendar-days"
                class="w-full"
                @update:model-value="value => clearFormState.startAt = fromDateValue(value as { year: number, month: number, day: number } | null)"
              />
            </UFormField>

            <UFormField name="endAt" label="结束日期">
              <UInputDate
                :model-value="toDateValue(clearFormState.endAt)"
                locale="zh-CN"
                icon="i-lucide-calendar-days"
                class="w-full"
                @update:model-value="value => clearFormState.endAt = fromDateValue(value as { year: number, month: number, day: number } | null)"
              />
            </UFormField>
          </div>
          <p class="text-sm text-muted">
            不填时间范围将清除全部日志。
          </p>
        </UForm>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="clearOpen = false">
            取消
          </UButton>
          <UButton
            type="submit"
            form="clear-log-form"
            color="error"
            :loading="clearLoading"
          >
            确认清除
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
