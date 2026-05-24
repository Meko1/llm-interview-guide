<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import HomeExtras from './components/HomeExtras.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-features-after>
      <HomeExtras />
    </template>
  </Layout>
</template>
