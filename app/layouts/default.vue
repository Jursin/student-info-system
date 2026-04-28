<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { DynamicTable } from '~/types'

const open = ref(false)
const { isAdmin } = useRole()
const { data: tables } = await useFetch<DynamicTable[]>('/api/tables', {
  default: () => []
})

const links = computed<NavigationMenuItem[][]>(() => {
  const primary: NavigationMenuItem[] = [{
    label: '仪表盘',
    icon: 'i-lucide-layout-dashboard',
    to: '/',
    onSelect: () => {
      open.value = false
    }
  }]

  if (isAdmin.value) {
    primary.splice(1, 0, {
      label: '角色管理',
      icon: 'i-lucide-shield-user',
      to: '/admin/roles',
      onSelect: () => {
        open.value = false
      }
    })
  }

  primary.push({
    label: '信息表',
    icon: 'i-lucide-table-properties',
    to: '/tables',
    defaultOpen: true,
    onSelect: () => {
      open.value = false
    },
    children: tables.value.map(table => ({
      label: table.name,
      to: `/tables/${table.id}`,
      onSelect: () => {
        open.value = false
      }
    }))
  })

  if (isAdmin.value) {
    primary.push({
      label: '操作日志',
      icon: 'i-lucide-file-clock',
      to: '/admin/logs',
      onSelect: () => {
        open.value = false
      }
    })
  }

  return [primary]
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      style="min-width: 13rem; max-width: 24rem;"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="px-2 py-1 flex items-center" :class="collapsed ? 'justify-center' : 'gap-2'">
          <UIcon name="i-lucide-graduation-cap" class="size-5 text-highlighted shrink-0" />
          <p v-if="!collapsed" class="text-base font-semibold text-highlighted truncate">
            学生信息管理系统
          </p>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>
    </UDashboardSidebar>
    <slot />
  </UDashboardGroup>
</template>
