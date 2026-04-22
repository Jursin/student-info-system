<script setup lang="ts">
import type { DynamicField } from '~/types'
import { fromDateValue, toDateValue } from '~/utils/date'

const props = withDefaults(defineProps<{
  field: DynamicField
  modelValue?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectItems = computed(() => (props.field.options || []).map(option => ({
  label: option,
  value: option
})))

const fieldLimit = computed(() => props.field.limit || 25)

function sanitizeValue(value: string) {
  if (props.field.type === 'number') {
    return value.replace(/\D+/g, '').slice(0, fieldLimit.value)
  }

  if (props.field.type === 'chinese') {
    return value.replace(/[^\u4e00-\u9fa5]/g, '').slice(0, fieldLimit.value)
  }

  if (props.field.type === 'date') {
    return value.slice(0, 10)
  }

  return value.slice(0, fieldLimit.value)
}

function updateValue(value: unknown) {
  emit('update:modelValue', sanitizeValue(String(value ?? '')))
}

function updateDateValue(value: unknown) {
  emit('update:modelValue', sanitizeValue(fromDateValue((value ?? null) as { year: number, month: number, day: number } | null)))
}
</script>

<template>
  <USelect
    v-if="field.type === 'singleChoice'"
    :model-value="modelValue"
    :items="selectItems"
    :disabled="disabled"
    class="w-full"
    @update:model-value="updateValue"
  />

  <UInputDate
    v-else-if="field.type === 'date'"
    class="w-full"
    icon="i-lucide-calendar"
    :model-value="toDateValue(modelValue)"
    :disabled="disabled"
    @update:model-value="updateDateValue"
  />

  <UInput
    v-else-if="field.type === 'number'"
    :model-value="modelValue"
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    :maxlength="fieldLimit"
    :disabled="disabled"
    class="w-full"
    @update:model-value="updateValue"
  />

  <UInput
    v-else
    :model-value="modelValue"
    type="text"
    :maxlength="fieldLimit"
    :disabled="disabled"
    class="w-full"
    @update:model-value="updateValue"
  />
</template>
