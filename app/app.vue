<script setup lang="ts">
import { zh_cn } from '@nuxt/ui/locale'

const colorMode = useColorMode()
const { ready, refreshSession } = useAuth()

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'zh-CN'
  }
})

const title = '学生信息管理系统'
const description = '一个全栈学生信息管理系统，提供学生信息的增删改查功能，支持多用户登录和权限管理。'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

if (!ready.value) {
  await refreshSession()
}
</script>

<template>
  <UApp :locale="zh_cn">
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
