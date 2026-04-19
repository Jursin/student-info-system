<script setup lang="ts">
import LogsTable from '../../components/admin/LogsTable.vue'

definePageMeta({
  middleware: ['admin']
})
</script>

<template>
  <UDashboardPanel id="admin-logs">
    <template #header>
      <UDashboardNavbar title="操作日志">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <NavbarActions />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <LogsTable />
    </template>
  </UDashboardPanel>
</template>
