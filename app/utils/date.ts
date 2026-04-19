import { parseDate } from '@internationalized/date'

type DateInput = { year: number, month: number, day: number } | null

export function toDateValue(value?: string | null) {
  if (!value) {
    return null
  }

  try {
    return parseDate(value)
  } catch {
    return null
  }
}

export function fromDateValue(value: DateInput) {
  if (!value) {
    return ''
  }

  const month = String(value.month).padStart(2, '0')
  const day = String(value.day).padStart(2, '0')
  return `${value.year}-${month}-${day}`
}
