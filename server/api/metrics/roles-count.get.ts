import { defineAuthedHandler } from '../../utils/auth'
import { countDistinctUserRoles } from '../../utils/store'

export default defineAuthedHandler({
  run: async () => {
    const count = await countDistinctUserRoles()
    return { count }
  },
  log: {
    action: 'read',
    target: 'metrics:roles-count',
    detail: '查看角色数量统计'
  }
})


