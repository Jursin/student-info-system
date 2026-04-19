import { canManageTables } from '../../utils/access'
import { defineAuthedHandler } from '../../utils/auth'
import { listDynamicTables } from '../../utils/store'

export default defineAuthedHandler({
  authorize: (user) => {
    if (!canManageTables(user)) {
      throw createError({ statusCode: 403, statusMessage: '无权限查看表定义' })
    }
  },
  run: async () => {
    return listDynamicTables()
  },
  log: {
    action: 'read',
    target: 'tables',
    detail: '查看表定义'
  }
})


