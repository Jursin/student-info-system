import { defineAuthedHandler } from '../../utils/auth'
import { BASIC_INFO_TABLE_ID, listDynamicTableUserIds, listDynamicTables, listStudentProfiles } from '../../utils/store'

export default defineAuthedHandler({
  run: async (_event, user) => {
    const tables = await listDynamicTables()
    const classStudents = await listStudentProfiles({ className: user.className })

    let myTableCount = 0
    for (const table of tables) {
      if (table.type !== 'partial' || table.id === BASIC_INFO_TABLE_ID) {
        myTableCount += 1
        continue
      }

      const userIds = await listDynamicTableUserIds(table.id)
      if (userIds.includes(user.userId)) {
        myTableCount += 1
      }
    }

    return {
      myTableCount,
      classStudentCount: classStudents.length
    }
  },
  log: {
    action: 'read',
    target: 'metrics:student-dashboard',
    detail: '查看学生仪表盘统计'
  }
})
