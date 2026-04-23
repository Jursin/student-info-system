export function getRequestErrorMessage(error: unknown, fallback = '请稍后重试') {
  return (error as { data?: { message?: string } })?.data?.message || fallback
}
