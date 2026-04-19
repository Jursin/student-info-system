import { defineAuthedHandler } from '../../utils/auth'
import { listDynamicTables } from '../../utils/store'

export default defineAuthedHandler({
  run: async () => {
    return listDynamicTables()
  },
  log: {
    action: 'read',
    target: 'tables',
    detail: '查看表导航列表'
  }
})


