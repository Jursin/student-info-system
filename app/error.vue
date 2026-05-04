<script setup lang="ts">
import type { NuxtError } from '#app'
import { zh_cn } from '@nuxt/ui/locale'

defineProps<{
  error: NuxtError
}>()

useSeoMeta({
  title: '页面未找到',
  description: '您访问的页面不存在。'
})

useHead({
  htmlAttrs: {
    lang: 'zh-CN'
  }
})
</script>

<template>
  <UApp :locale="zh_cn">
    <UError
      :clear="{
        label: '回到首页'
      }"
      :error="{
        statusCode: 404,
        statusMessage: '页面未找到',
        message: '您访问的页面不存在。'
      }"
    />
  </UApp>
</template>
