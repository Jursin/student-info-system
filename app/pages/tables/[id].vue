<script setup lang="ts">
import { getPaginationRowModel, type Row, type SortingState } from '@tanstack/table-core'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import * as XLSX from 'xlsx'
import type { DynamicTable } from '~/types'
import { getRequestErrorMessage } from '~/utils/error'
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
const { isAdmin, isStudent, isClassLeader } = useRole()
const { user } = useAuth()
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
const actionConfirmNames = ref<string[]>([])
const exportOpen = ref(false)
const exportAllRows = ref<RowRecord[]>([])
const exportMissingRows = ref<Array<{ userId: string, name: string }>>([])
const exportTimestamp = ref('')
const exportOnlyMissing = ref(false)
const importing = ref(false)
const importFileInput = ref<HTMLInputElement | null>(null)

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
const studentFormFields = computed(() => tableData.value.table.fields.filter(field => field.key !== 'password'))
const editorFormFields = computed(() => tableData.value.table.fields.filter(field => field.key !== 'password'))

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

const coreFieldKeys = new Set(['userId', 'name', 'className'])
const profileFieldKeys = new Set(['userId', 'name', 'className', 'gender'])

const studentFormState = ref<Record<string, string>>({})
const studentSubmitting = ref(false)
const studentRow = computed(() => tableData.value.rows[0] || null)

watch(
  [() => tableData.value.table.id, studentRow],
  ([tableId, row]) => {
    if (!tableId) {
      return
    }

    studentFormState.value = Object.fromEntries(
      tableData.value.table.fields
        .filter(field => field.key !== 'password')
        .map(field => [field.key, row?.[field.key] || ''])
    )
  },
  { immediate: true }
)

function isStudentReadonlyField(key: string) {
  return coreFieldKeys.has(key)
}

function getFieldLimit(field: DynamicTable['fields'][number]) {
  return field.limit || 25
}

function normalizeFieldValue(field: DynamicTable['fields'][number], value: string) {
  const limit = getFieldLimit(field)
  if (field.type === 'number') {
    return value.replace(/\D+/g, '').slice(0, limit)
  }

  if (field.type === 'chinese') {
    return value.replace(/[^\u4e00-\u9fa5]/g, '').slice(0, limit)
  }

  if (field.type === 'date') {
    return value.slice(0, 10)
  }

  return value.slice(0, limit)
}

function buildFieldValues(state: Record<string, string>, options?: { includeCoreFields?: boolean }) {
  const includeCoreFields = options?.includeCoreFields ?? false

  return tableData.value.table.fields
    .filter(field => field.key !== 'password' && (includeCoreFields || !coreFieldKeys.has(field.key)))
    .reduce((acc, field) => {
      acc[field.key] = normalizeFieldValue(field, String(state[field.key] ?? ''))
      return acc
    }, {} as Record<string, string>)
}

function buildStudentPayload(state: Record<string, string>, options?: { includeCoreFields?: boolean }) {
  const values = buildFieldValues(state, options)
  const payload: Record<string, unknown> = {
    tableId: tableId.value,
    values
  }

  for (const [key, value] of Object.entries(values)) {
    if (profileFieldKeys.has(key)) {
      payload[key] = value
    }
  }

  return payload
}

function updateStudentFieldValue(field: DynamicTable['fields'][number], value: string) {
  studentFormState.value[field.key] = normalizeFieldValue(field, value)
}

async function submitStudentDetailForm() {
  const userId = String(studentFormState.value.userId || user.value?.userId || '').trim()
  if (!userId) {
    toast.add({ color: 'error', title: '保存失败', description: '缺少学号，无法提交' })
    return
  }

  const body = buildStudentPayload(studentFormState.value)

  studentSubmitting.value = true
  try {
    await $fetch(`/api/students/${userId}`, {
      method: 'PUT',
      body
    })
    toast.add({ title: '保存成功' })
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: '保存失败', description })
  } finally {
    studentSubmitting.value = false
  }
}

const isBasicInfoTable = computed(() => tableId.value === 'basic-info')
const tableTypeLabel = computed(() => tableData.value.table.type === 'full' ? '全员表' : '部分表')
const selectedCount = computed(() => table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0)

const actionConfirmTitle = computed(() => actionConfirmType.value === 'delete' ? '确认删除' : '确认重置密码')
const actionConfirmDescription = computed(() => {
  const count = actionConfirmIds.value.length
  if (actionConfirmType.value === 'delete') {
    return count > 1
      ? `即将删除 ${count} 名学生，删除后不可恢复，是否继续？`
      : `即将删除学生 ${actionConfirmNames.value[0] || actionConfirmIds.value[0] || ''}，删除后不可恢复，是否继续？`
  }

  return count > 1
    ? `即将重置 ${count} 名学生的密码，是否继续？`
    : `即将重置学生 ${actionConfirmIds.value[0] || ''} 的密码，是否继续？`
})

const exportFields = computed(() => tableData.value.table.fields.filter(field => field.key !== 'password'))
const isExportOnlyMissingForced = computed(() => isClassLeader.value)
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024

function createEmptyFormState() {
  return Object.fromEntries(tableData.value.table.fields.map(field => [field.key, '']))
}

function updateEditorFieldValue(field: DynamicTable['fields'][number], value: string) {
  formState.value[field.key] = normalizeFieldValue(field, value)
}

function openAddModal() {
  formState.value = createEmptyFormState()
  addOpen.value = true
}

function openEditModal(row: Record<string, string>) {
  const rowUserId = String(row.userId || '')
  if (!isAdmin.value && (!isClassLeader.value || rowUserId !== user.value?.userId)) {
    return
  }

  formState.value = createEmptyFormState()
  for (const field of tableData.value.table.fields) {
    formState.value[field.key] = row[field.key] || ''
  }
  editingUserId.value = rowUserId
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
const isCoreField = (key: string) => coreFieldKeys.has(key)
const isFieldReadonlyInEdit = (key: string) => {
  if (!isEditingForm.value) {
    return false
  }

  if (isAdmin.value) {
    return !isBasicInfoTable.value && coreFieldKeys.has(key)
  }

  if (isClassLeader.value) {
    return coreFieldKeys.has(key)
  }

  return true
}

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
      body: buildStudentPayload(formState.value, { includeCoreFields: true })
    })
    toast.add({ title: '添加成功' })
    addOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: '添加失败', description })
  } finally {
    submitting.value = false
  }
}

async function updateRow() {
  if ((!isAdmin.value && !isClassLeader.value) || !editingUserId.value) {
    return
  }

  if (isClassLeader.value && editingUserId.value !== user.value?.userId) {
    return
  }

  submitting.value = true
  try {
    await $fetch(`/api/students/${editingUserId.value}`, {
      method: 'PUT',
      body: buildStudentPayload(formState.value, { includeCoreFields: isBasicInfoTable.value })
    })
    toast.add({ title: '修改成功' })
    editOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: '修改失败', description })
  } finally {
    submitting.value = false
  }
}

function openActionConfirm(type: 'delete' | 'reset', ids: string[], names: string[] = []) {
  if (!ids.length) {
    return
  }

  actionConfirmType.value = type
  actionConfirmIds.value = ids
  actionConfirmNames.value = names
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
    const description = getRequestErrorMessage(error)
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
      toast.add({ title: `已批量重置 ${ids.length} 名学生密码` })
    } else {
      toast.add({ title: `已重置 ${ids[0] || ''} 的密码` })
    }

    editOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const description = getRequestErrorMessage(error)
    toast.add({ color: 'error', title: '重置密码失败', description })
  } finally {
    submitting.value = false
  }
}

function requestDeleteRows(ids: string[], names: string[] = []) {
  if (!isAdmin.value) {
    return
  }

  openActionConfirm('delete', ids, names)
}

function requestDeleteSelectedRows() {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  const ids = selectedRows
    .map(row => row.original.userId)
    .filter((id): id is string => Boolean(id))
  const names = selectedRows
    .map(row => String(row.original.name || ''))
    .filter(Boolean)

  requestDeleteRows(ids, names)
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

function pickRowsWithMissingValues(rows: RowRecord[]) {
  const checkFields = tableData.value.table.fields.filter(field => field.key !== 'password')

  return rows
    .map((row) => {
      const hasMissingField = checkFields
        .some(field => !String(row[field.key] ?? '').trim())

      if (!hasMissingField) {
        return null
      }

      return {
        userId: String(row.userId || ''),
        name: String(row.name || '')
      }
    })
    .filter((item): item is { userId: string, name: string } => Boolean(item))
}

function formatEast8Timestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date)

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ''
  return `${getPart('year')}${getPart('month')}${getPart('day')}${getPart('hour')}${getPart('minute')}${getPart('second')}`
}

function sanitizeFileNameSegment(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
}

function buildExportFileNameBase() {
  const tableName = sanitizeFileNameSegment(tableData.value.table.name || '信息表') || '信息表'
  const timestamp = exportTimestamp.value || formatEast8Timestamp()
  return `${tableName}_${timestamp}`
}

function buildExportHeaders() {
  return exportFields.value.map(field => field.label)
}

function buildExportValueRows(rows: RowRecord[]) {
  return rows.map(row => exportFields.value.map(field => String(row[field.key] ?? '')))
}

function buildExportMissingRows(rows: Array<{ userId: string, name: string }>) {
  return rows.map(row => [row.userId, row.name])
}

function buildTemplateFileName() {
  const tableName = sanitizeFileNameSegment(tableData.value.table.name || '信息表') || '信息表'
  return `${tableName}_导入模板.xlsx`
}

function requestExportSelectedRows() {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  if (!selectedRows.length) {
    toast.add({ color: 'warning', title: '未选择成员', description: '请先选择要导出的成员' })
    return
  }

  exportAllRows.value = selectedRows.map(row => ({ ...row.original }))
  exportMissingRows.value = pickRowsWithMissingValues(selectedRows.map(row => row.original))
  exportOnlyMissing.value = isExportOnlyMissingForced.value
  exportTimestamp.value = formatEast8Timestamp()
  exportOpen.value = true
}

function openImportFileSelector() {
  if (!import.meta.client || importing.value) {
    return
  }

  importFileInput.value?.click()
}

function normalizeImportValue(value: unknown) {
  return String(value ?? '').trim()
}

function hasMergedCells(worksheet: XLSX.WorkSheet) {
  return Boolean((worksheet['!merges'] || []).length)
}

function getExpectedImportHeaders() {
  return tableData.value.table.fields
    .filter(field => field.key !== 'password')
    .map(field => field.label.trim())
}

function normalizeHeaderText(value: unknown) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim()
}

function parseImportRows(file: File) {
  return new Promise<RowRecord[]>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取导入文件失败'))
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          resolve([])
          return
        }

        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          resolve([])
          return
        }

        if (hasMergedCells(worksheet)) {
          throw new Error('导入文件包含合并单元格，请先取消合并后再导入')
        }

        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
          raw: false
        })

        if (!rawRows.length) {
          throw new Error('导入文件没有可用数据')
        }

        const headerMap = new Map<string, string>()
        const expectedHeaders = getExpectedImportHeaders()
        for (const field of tableData.value.table.fields.filter(field => field.key !== 'password')) {
          headerMap.set(field.key.trim().toLowerCase(), field.key)
          headerMap.set(field.label.trim().toLowerCase(), field.key)
        }

        const actualHeaders = Object.keys(rawRows[0] || {}).map(normalizeHeaderText)
        const actualFieldKeys = new Set<string>()

        for (const header of actualHeaders) {
          const fieldKey = headerMap.get(header.toLowerCase())
          if (!fieldKey) {
            throw new Error('表头不对应，请使用模板文件后再导入')
          }
          actualFieldKeys.add(fieldKey)
        }

        if (!actualHeaders.length) {
          throw new Error('表头不对应，请使用模板文件后再导入')
        }

        if (actualFieldKeys.size !== expectedHeaders.length) {
          throw new Error('表头不对应，请使用模板文件后再导入')
        }

        const rows: RowRecord[] = rawRows
          .map((raw) => {
            const row: RowRecord = {}
            for (const [header, value] of Object.entries(raw)) {
              const fieldKey = headerMap.get(String(header).trim().toLowerCase())
              if (fieldKey) {
                row[fieldKey] = normalizeImportValue(value)
              }
            }
            return row
          })
          .filter((row) => {
            const hasRequiredFields = Boolean(row.userId?.trim() && row.name?.trim())
            return hasRequiredFields
          })

        if (!rows.length) {
          throw new Error('导入文件中的数据不合法')
        }

        resolve(rows)
      } catch (error: unknown) {
        if (error instanceof Error) {
          reject(error)
          return
        }

        reject(new Error('导入文件格式不正确，请使用 Excel 或 CSV 模板'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

async function importRows(rows: RowRecord[]) {
  if (!rows.length) {
    toast.add({ color: 'warning', title: '导入失败', description: '文件中没有可导入的数据' })
    return
  }

  importing.value = true
  let successCount = 0
  let failedCount = 0

  try {
    for (const row of rows) {
      const userId = String(row.userId || '').trim()
      const name = String(row.name || '').trim()
      if (!userId || !name) {
        failedCount += 1
        continue
      }

      const updatePayload = buildStudentPayload(row, { includeCoreFields: isBasicInfoTable.value })
      const createPayload = buildStudentPayload(row, { includeCoreFields: true })

      try {
        await $fetch(`/api/students/${encodeURIComponent(userId)}`, {
          method: 'PUT',
          body: updatePayload
        })
        successCount += 1
      } catch {
        try {
          await $fetch('/api/students', {
            method: 'POST',
            body: createPayload
          })
          successCount += 1
        } catch {
          failedCount += 1
        }
      }
    }

    if (successCount > 0) {
      await refresh()
    }

    if (failedCount > 0) {
      toast.add({
        color: 'warning',
        title: `导入完成：成功 ${successCount} 条，失败 ${failedCount} 条`,
        description: '失败记录可能是缺少学号/姓名或数据格式不符合要求'
      })
      return
    }

    toast.add({ title: `导入成功，共 ${successCount} 条` })
  } finally {
    importing.value = false
  }
}

async function onImportFileChange(event: Event) {
  if (!isAdmin.value || importing.value) {
    return
  }

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }

  if (file.size > MAX_IMPORT_FILE_SIZE) {
    toast.add({ color: 'error', title: '导入失败', description: '文件过大，建议拆分后依次导入' })
    return
  }

  try {
    const rows = await parseImportRows(file)
    await importRows(rows)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : getRequestErrorMessage(error, '请检查文件格式后重试')
    toast.add({ color: 'error', title: '导入失败', description: message })
  }
}

function downloadImportTemplate() {
  const headers = tableData.value.table.fields
    .filter(field => field.key !== 'password')
    .map(field => field.label)

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([headers])
  XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板')
  const xlsxArray = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([xlsxArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  triggerDownload(buildTemplateFileName(), blob)
}

function escapeCsvValue(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function triggerDownload(fileName: string, blob: Blob) {
  if (!import.meta.client) {
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function downloadMissingMembersCsv() {
  if (exportOnlyMissing.value && !exportMissingRows.value.length) {
    toast.add({ color: 'warning', title: '未找到空值成员', description: '当前勾选条件下没有可导出的成员' })
    return
  }

  const lines = exportOnlyMissing.value
    ? [
        ['学号', '姓名'].map(escapeCsvValue).join(','),
        ...buildExportMissingRows(exportMissingRows.value).map(row => row.map(escapeCsvValue).join(','))
      ]
    : [
        buildExportHeaders().map(escapeCsvValue).join(','),
        ...buildExportValueRows(exportAllRows.value).map(row => row.map(escapeCsvValue).join(','))
      ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(`${buildExportFileNameBase()}.csv`, blob)
}

function downloadMissingMembersExcel() {
  if (exportOnlyMissing.value && !exportMissingRows.value.length) {
    toast.add({ color: 'warning', title: '未找到空值成员', description: '当前勾选条件下没有可导出的成员' })
    return
  }

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(
    exportOnlyMissing.value
      ? [
          ['学号', '姓名'],
          ...buildExportMissingRows(exportMissingRows.value)
        ]
      : [
          buildExportHeaders(),
          ...buildExportValueRows(exportAllRows.value)
        ]
  )

  XLSX.utils.book_append_sheet(workbook, worksheet, '空值成员名单')
  const xlsxArray = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([xlsxArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  triggerDownload(`${buildExportFileNameBase()}.xlsx`, blob)
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
      onSelect: () => requestDeleteRows(
        [String(row.original.userId || '')],
        [String(row.original.name || '')]
      )
    })
  } else if (isClassLeader.value && String(row.original.userId || '') === user.value?.userId) {
    items.push({
      label: '修改',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditModal(row.original)
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

  const columns: TableColumn<RowRecord>[] = [
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
    ...fieldColumns
  ]

  if (isAdmin.value || isClassLeader.value) {
    columns.push({
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
        const items = getRowItems(row)
        if (!items.length) {
          return h('div')
        }

        return h('div', { class: 'text-right' }, h(UDropdownMenu, {
          items,
          content: { align: 'end' }
        }, () => h(UButton, {
          icon: 'i-lucide-ellipsis-vertical',
          color: 'neutral',
          variant: 'ghost'
        })))
      }
    })
  }

  return columns
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
  if (!isStudent.value) {
    startPolling()
  }
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
      <div v-if="isStudent" class="space-y-4">
        <UCard>
          <UForm
            class="grid grid-cols-1 lg:grid-cols-4 gap-4"
            :state="studentFormState"
            @submit="submitStudentDetailForm"
          >
            <UFormField
              v-for="field in studentFormFields"
              :key="field.key"
              :name="field.key"
              :label="field.label"
            >
              <TablesFieldValueInput
                :field="field"
                :model-value="studentFormState[field.key]"
                :disabled="isStudentReadonlyField(field.key)"
                @update:model-value="value => updateStudentFieldValue(field, value)"
              />
            </UFormField>
            <div class="lg:col-span-4 flex justify-end">
              <UButton type="submit" color="primary" :loading="studentSubmitting">
                保存
              </UButton>
            </div>
          </UForm>
        </UCard>
      </div>

      <div v-else class="space-y-4">
        <input
          ref="importFileInput"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="onImportFileChange"
        >

        <div class="flex flex-wrap items-center justify-between gap-2">
          <UInput
            v-model="searchKeyword"
            icon="i-lucide-search"
            placeholder="搜索所有字段"
            class="max-w-sm"
          />

          <div class="flex flex-wrap items-center gap-2">
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
              @click="requestDeleteSelectedRows"
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
              @click="requestResetSelectedPasswords"
            >
              重置密码
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

            <UButton
              v-if="isAdmin"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              :loading="importing"
              @click="openImportFileSelector"
            >
              导入数据
            </UButton>

            <UButton
              v-if="selectedCount > 0"
              color="neutral"
              variant="outline"
              icon="i-lucide-upload"
              @click="requestExportSelectedRows"
            >
              导出数据
            </UButton>

            <UButton
              v-if="isAdmin"
              icon="i-lucide-file-down"
              color="neutral"
              variant="outline"
              @click="downloadImportTemplate"
            >
              下载模板
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
            :page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
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
                v-for="field in editorFormFields"
                :key="field.key"
                :name="field.key"
                :label="field.label"
                :required="isCoreField(field.key)"
              >
                <TablesFieldValueInput
                  :field="field"
                  :model-value="formState[field.key]"
                  :disabled="isFieldReadonlyInEdit(field.key)"
                  @update:model-value="value => updateEditorFieldValue(field, value)"
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
                  @click="requestResetPassword"
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

        <UModal v-model:open="exportOpen" title="导出数据">
          <template #body>
            <div class="space-y-4">
              <UCheckbox
                v-model="exportOnlyMissing"
                label="仅未填完名单"
                :disabled="isExportOnlyMissingForced"
              />
              <p class="text-sm text-muted">
                {{ exportOnlyMissing ? `当前有 ${exportMissingRows.length} 名未填完成员可导出` : `当前有 ${exportAllRows.length} 名已选成员可导出` }}
              </p>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton color="neutral" variant="ghost" @click="exportOpen = false">
                取消
              </UButton>
              <UButton color="neutral" variant="outline" @click="downloadMissingMembersCsv">
                下载 CSV 文件
              </UButton>
              <UButton color="primary" @click="downloadMissingMembersExcel">
                下载 Excel 文件
              </UButton>
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
