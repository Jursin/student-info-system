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
const description = '面向学生、班委、管理员与超级管理员的学生信息管理平台，支持一次录入、多方复用和细粒度权限控制。'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/dashboard-light.png',
  twitterCard: 'summary_large_image'
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
