<script setup lang="ts">
import type { DynamicTable, OperationLog, StudentProfile } from '~/types'
import { fromDateValue, toDateValue } from '~/utils/date'

const { isAdmin, isStudent, isClassLeader } = useRole()
const isStudentLike = computed(() => isStudent.value || isClassLeader.value)

type TrendKey = 'login' | 'create' | 'delete' | 'update'
type TrendRange = '24h' | '7d' | '1m' | '6m' | 'custom'

const { data } = await useFetch<StudentProfile[]>('/api/students', {
  default: () => []
})

const { data: tables } = await useFetch<DynamicTable[]>('/api/admin/tables', {
  default: () => [],
  immediate: isAdmin.value
})

const { data: logs } = await useFetch<OperationLog[]>('/api/admin/logs', {
  default: () => [],
  immediate: isAdmin.value
})

const { data: roleStats } = await useFetch<{ count: number }>('/api/metrics/roles-count', {
  default: () => ({ count: 0 }),
  immediate: isAdmin.value
})

const { data: studentStats } = await useFetch<{ myTableCount: number, classStudentCount: number }>('/api/metrics/student-dashboard', {
  default: () => ({ myTableCount: 0, classStudentCount: 0 }),
  immediate: isStudentLike.value
})

const classCount = computed(() => new Set(data.value.map(item => item.className.trim()).filter(Boolean)).size)
const roleCount = computed(() => roleStats.value.count)
const tableCount = computed(() => isAdmin.value ? tables.value.length : 0)
const myTableCount = computed(() => studentStats.value.myTableCount)
const classStudentCount = computed(() => studentStats.value.classStudentCount)
const statsGridClass = computed(() => isStudentLike.value ? 'lg:grid-cols-2 gap-4 sm:gap-6' : 'lg:grid-cols-4 gap-4 sm:gap-6')
const statsCards = computed(() => {
  if (isStudentLike.value) {
    return [
      {
        key: 'my-table-count',
        title: '我的信息表数量',
        icon: 'i-lucide-table-properties',
        value: myTableCount.value
      },
      {
        key: 'class-student-count',
        title: '本班学生人数',
        icon: 'i-lucide-users',
        value: classStudentCount.value
      }
    ]
  }

  return [
    {
      key: 'role-count',
      title: '角色数量',
      icon: 'i-lucide-shield-user',
      value: roleCount.value
    },
    {
      key: 'table-count',
      title: '信息表数量',
      icon: 'i-lucide-table-properties',
      value: tableCount.value
    },
    {
      key: 'student-count',
      title: '学生总人数',
      icon: 'i-lucide-users',
      value: data.value.length
    },
    {
      key: 'class-count',
      title: '班级数量',
      icon: 'i-lucide-book-user',
      value: classCount.value
    }
  ]
})

const trendRange = ref<TrendRange>('7d')
const appliedTrendRange = ref<TrendRange>('7d')
const customRangeOpen = ref(false)
const trendCustomStart = ref('')
const trendCustomEnd = ref('')
const appliedTrendCustomStart = ref('')
const appliedTrendCustomEnd = ref('')
const trendCustomStartModel = computed(() => toDateValue(trendCustomStart.value))
const trendCustomEndModel = computed(() => toDateValue(trendCustomEnd.value))
const trendAllKeys: TrendKey[] = ['login', 'create', 'delete', 'update']
const selectedTrendKeys = ref<TrendKey[]>([...trendAllKeys])

const trendRangeOptions = [
  { label: '最近24小时', value: '24h' as const },
  { label: '最近7天', value: '7d' as const },
  { label: '最近1个月', value: '1m' as const },
  { label: '最近半年', value: '6m' as const },
  { label: '自定义', value: 'custom' as const }
]

const trendLegendItems: Array<{ key: TrendKey, label: string }> = [
  { key: 'login', label: '登录' },
  { key: 'create', label: '添加' },
  { key: 'delete', label: '删除' },
  { key: 'update', label: '修改' }
]

const trendFilterBaseItems = [
  {
    label: '全部',
    icon: 'i-lucide-list-checks',
    onSelect: () => selectAllTrends()
  },
  {
    type: 'separator' as const
  }
]

const trendCategories = {
  login: {
    name: '登录',
    color: 'color-mix(in oklab, var(--ui-primary) 55%, white)'
  },
  create: {
    name: '添加',
    color: 'color-mix(in oklab, var(--ui-primary) 75%, white)'
  },
  delete: {
    name: '删除',
    color: 'var(--ui-primary)'
  },
  update: {
    name: '修改',
    color: 'color-mix(in oklab, var(--ui-primary) 80%, black)'
  }
}

const visibleTrendCategories = computed(() => {
  const picked = new Set(selectedTrendKeys.value)
  const result: Partial<typeof trendCategories> = {}

  for (const key of trendAllKeys) {
    if (picked.has(key)) {
      result[key] = trendCategories[key]
    }
  }

  // 至少保留一条曲线，避免图表空数据造成交互困惑。
  if (!Object.keys(result).length) {
    result.login = trendCategories.login
  }

  return result
})

const selectedTrendLabel = computed(() => {
  if (selectedTrendKeys.value.length === trendAllKeys.length) {
    return '全部分类'
  }

  if (selectedTrendKeys.value.length === 1) {
    const key = selectedTrendKeys.value[0]
    return trendLegendItems.find(item => item.key === key)?.label || '分类筛选'
  }

  return `已选${selectedTrendKeys.value.length}项`
})

function isTrendSelected(key: TrendKey): boolean {
  return selectedTrendKeys.value.includes(key)
}

function selectAllTrends() {
  selectedTrendKeys.value = [...trendAllKeys]
}

function toggleTrendSelection(key: TrendKey, checked: boolean) {
  if (checked) {
    if (!selectedTrendKeys.value.includes(key)) {
      selectedTrendKeys.value = [...selectedTrendKeys.value, key]
    }
    return
  }

  const next = selectedTrendKeys.value.filter(item => item !== key)
  if (!next.length) {
    return
  }

  selectedTrendKeys.value = next
}

const trendFilterItems = computed(() => [...trendFilterBaseItems, ...trendLegendItems.map(item => ({
  label: item.label,
  type: 'checkbox' as const,
  checked: isTrendSelected(item.key),
  onUpdateChecked(checked: boolean) {
    toggleTrendSelection(item.key, checked)
  },
  onSelect(e?: Event) {
    e?.preventDefault()
  }
}))])

function toDateText(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function setDefaultCustomRange() {
  const today = new Date()
  const lastYearToday = new Date(today)
  lastYearToday.setFullYear(today.getFullYear() - 1)

  trendCustomStart.value = toDateText(lastYearToday)
  trendCustomEnd.value = toDateText(today)
}

watch(trendRange, (value) => {
  if (value === 'custom') {
    if (appliedTrendRange.value === 'custom' && appliedTrendCustomStart.value && appliedTrendCustomEnd.value) {
      trendCustomStart.value = appliedTrendCustomStart.value
      trendCustomEnd.value = appliedTrendCustomEnd.value
    } else {
      setDefaultCustomRange()
    }
    customRangeOpen.value = true
    return
  }

  appliedTrendRange.value = value
})

watch(customRangeOpen, (open) => {
  if (!open && trendRange.value === 'custom' && appliedTrendRange.value !== 'custom') {
    trendRange.value = appliedTrendRange.value
    trendCustomStart.value = appliedTrendCustomStart.value
    trendCustomEnd.value = appliedTrendCustomEnd.value
  }
})

function calendarDateToDate(value: string, endOfDay = false): Date | null {
  if (!value) {
    return null
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (!year || !month || !day) {
    return null
  }

  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  )
}

function formatBucketLabel(date: Date, unit: 'hour' | 'day' | 'month'): string {
  if (unit === 'hour') {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
  }

  if (unit === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function getRangeConfig(): { start: Date, end: Date, unit: 'hour' | 'day' | 'month' } {
  const now = new Date()

  if (appliedTrendRange.value === '24h') {
    return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now, unit: 'hour' as const }
  }

  if (appliedTrendRange.value === '7d') {
    return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now, unit: 'day' as const }
  }

  if (appliedTrendRange.value === '1m') {
    return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now, unit: 'day' as const }
  }

  if (appliedTrendRange.value === '6m') {
    const start = new Date(now)
    start.setMonth(start.getMonth() - 6)
    return { start, end: now, unit: 'month' as const }
  }

  const customStart = calendarDateToDate(appliedTrendCustomStart.value)
  const customEnd = calendarDateToDate(appliedTrendCustomEnd.value, true)
  const end = customEnd || now
  const start = customStart && customStart.getTime() < end.getTime()
    ? customStart
    : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

  const diffMs = end.getTime() - start.getTime()
  const unit: 'hour' | 'day' | 'month' = diffMs <= 2 * 24 * 60 * 60 * 1000
    ? 'hour'
    : (diffMs <= 62 * 24 * 60 * 60 * 1000 ? 'day' : 'month')

  return { start, end, unit }
}

function createBuckets(start: Date, end: Date, unit: 'hour' | 'day' | 'month') {
  const buckets: Array<{ start: Date, end: Date, label: string }> = []
  const cursor = new Date(start)

  if (unit === 'hour') {
    cursor.setMinutes(0, 0, 0)
  }

  if (unit === 'day') {
    cursor.setHours(0, 0, 0, 0)
  }

  if (unit === 'month') {
    cursor.setDate(1)
    cursor.setHours(0, 0, 0, 0)
  }

  while (cursor.getTime() <= end.getTime()) {
    const bucketStart = new Date(cursor)
    const bucketEnd = new Date(cursor)

    if (unit === 'hour') {
      bucketEnd.setHours(bucketEnd.getHours() + 1)
    } else if (unit === 'day') {
      bucketEnd.setDate(bucketEnd.getDate() + 1)
    } else {
      bucketEnd.setMonth(bucketEnd.getMonth() + 1)
    }

    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      label: formatBucketLabel(bucketStart, unit)
    })

    cursor.setTime(bucketEnd.getTime())
  }

  return buckets
}

const trendSeries = computed(() => {
  const { start, end, unit } = getRangeConfig()
  const buckets = createBuckets(start, end, unit)
  const series = buckets.map(bucket => ({
    label: bucket.label,
    login: 0,
    create: 0,
    delete: 0,
    update: 0
  }))

  for (const log of logs.value) {
    const date = new Date(log.timestamp)
    if (date.getTime() < start.getTime() || date.getTime() > end.getTime()) {
      continue
    }

    const index = buckets.findIndex(bucket => date.getTime() >= bucket.start.getTime() && date.getTime() < bucket.end.getTime())
    if (index < 0) {
      continue
    }

    const current = series[index]
    if (!current) {
      continue
    }

    if (log.action === 'login' || log.action === 'create' || log.action === 'delete' || log.action === 'update') {
      current[log.action] += 1
    }
  }

  return series
})

const trendChartData = computed(() => trendSeries.value.map(item => ({
  date: item.label,
  login: item.login,
  create: item.create,
  delete: item.delete,
  update: item.update
})))

const studentTableTrendData = computed(() => {
  const { start, end, unit } = getRangeConfig()
  const buckets = createBuckets(start, end, unit)

  return buckets.map(bucket => ({
    date: bucket.label,
    tables: myTableCount.value
  }))
})

const studentTrendCategories = {
  tables: {
    name: '信息表数量',
    color: 'var(--ui-primary)'
  }
}

const trendTitle = computed(() => isStudentLike.value ? '我的信息表数量趋势' : '事件趋势')
const trendData = computed(() => isStudentLike.value ? studentTableTrendData.value : trendChartData.value)
const trendCategoriesForView = computed(() => isStudentLike.value ? studentTrendCategories : visibleTrendCategories.value)
const trendDataForChart = computed(() => trendData.value as Array<Record<string, string | number>>)
const trendCategoriesForChart = computed(() => trendCategoriesForView.value as Record<string, { name: string, color: string }>)

function trendXFormatter(index: number): string {
  return trendData.value[index]?.date || ''
}

const trendTooltipStyle = {
  '--vis-tooltip-background-color': 'var(--ui-bg)',
  '--vis-tooltip-border-color': 'var(--ui-border)',
  '--vis-tooltip-text-color': 'var(--ui-text-highlighted)',
  '--vis-tooltip-title-color': 'var(--ui-text-highlighted)',
  '--vis-tooltip-label-color': 'var(--ui-text-toned)',
  '--vis-tooltip-value-color': 'var(--ui-text-highlighted)',
  '--vis-tooltip-box-shadow': '0 8px 20px color-mix(in oklab, var(--ui-border) 40%, transparent)'
}

function applyCustomRange() {
  appliedTrendCustomStart.value = trendCustomStart.value
  appliedTrendCustomEnd.value = trendCustomEnd.value
  appliedTrendRange.value = 'custom'
  trendRange.value = 'custom'
  customRangeOpen.value = false
}

function cancelCustomRange() {
  customRangeOpen.value = false
  trendRange.value = appliedTrendRange.value
  trendCustomStart.value = appliedTrendCustomStart.value
  trendCustomEnd.value = appliedTrendCustomEnd.value
}

function updateTrendCustomStart(value: unknown) {
  trendCustomStart.value = fromDateValue(value as { year: number, month: number, day: number } | null)
}

function updateTrendCustomEnd(value: unknown) {
  trendCustomEnd.value = fromDateValue(value as { year: number, month: number, day: number } | null)
}
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="仪表盘">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <NavbarActions />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UPageGrid :class="statsGridClass">
          <UPageCard
            v-for="card in statsCards"
            :key="card.key"
            :title="card.title"
            :icon="card.icon"
            variant="subtle"
            :ui="{
              title: 'font-normal text-muted text-xs uppercase',
              leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25'
            }"
            class="relative transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 hover:ring-1 hover:ring-primary/20 hover:z-1"
          >
            <p class="text-2xl font-semibold text-highlighted">
              {{ card.value }}
            </p>
          </UPageCard>
        </UPageGrid>

        <UCard v-if="isStudentLike || isAdmin">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <h2 class="text-lg font-semibold text-highlighted">
                  {{ trendTitle }}
                </h2>
                <USelect
                  v-model="trendRange"
                  :items="trendRangeOptions"
                  class="w-36"
                />
              </div>

              <div v-if="isAdmin" class="flex items-center gap-2">
                <UDropdownMenu :items="trendFilterItems" :content="{ align: 'end' }">
                  <UButton
                    class="w-32 justify-between"
                    color="neutral"
                    variant="outline"
                    trailing-icon="i-lucide-chevron-down"
                    @click.stop
                  >
                    {{ selectedTrendLabel }}
                  </UButton>
                </UDropdownMenu>
              </div>
            </div>
          </template>

          <div class="space-y-2">
            <LineChart
              :style="trendTooltipStyle"
              :data="trendDataForChart"
              :categories="trendCategoriesForChart"
              :height="isStudentLike ? 280 : 320"
              x-label="日期"
              :y-label="isStudentLike ? '数量' : '次数'"
              :x-formatter="trendXFormatter"
              :curve-type="isStudentLike ? undefined : ('step' as any)"
              :line-width="3"
              :x-grid-line="false"
              :y-grid-line="true"
              :x-tick-line="false"
              :y-tick-line="false"
              :legend-position="'top-right' as any"
            />
          </div>
        </UCard>

        <UModal
          v-model:open="customRangeOpen"
          title="自定义日期范围"
          :portal="true"
          :ui="{ content: 'max-w-xl' }"
        >
          <template #body>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormField label="开始日期">
                <UInputDate
                  :model-value="trendCustomStartModel"
                  locale="zh-CN"
                  icon="i-lucide-calendar-days"
                  class="w-full"
                  @update:model-value="updateTrendCustomStart"
                />
              </UFormField>

              <UFormField label="结束日期">
                <UInputDate
                  :model-value="trendCustomEndModel"
                  locale="zh-CN"
                  icon="i-lucide-calendar-days"
                  class="w-full"
                  @update:model-value="updateTrendCustomEnd"
                />
              </UFormField>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton color="neutral" variant="ghost" @click="cancelCustomRange">
                取消
              </UButton>
              <UButton @click="applyCustomRange">
                应用
              </UButton>
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
