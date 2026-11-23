<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData, withBase } from 'vitepress'
import { computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import HomePage from './components/HomePage.vue'
import ArticleMeta from './components/ArticleMeta.vue'

const { Layout } = DefaultTheme
const { page } = useData()
const isHome = computed(() => page.value.relativePath === 'index.md')
const isPath = computed(() => page.value.relativePath.startsWith('paths/'))
let sidebarObserver: MutationObserver | undefined
const keyboardReady = new WeakSet<Element>()

function normalizeSidebarControls() {
  document.querySelectorAll('.VPSidebarItem.collapsible > .item[role="button"]').forEach(item => {
    const caret = item.querySelector('.caret')
    if (!caret) return
    caret.removeAttribute('role')
    caret.removeAttribute('tabindex')
    caret.removeAttribute('aria-label')
    caret.setAttribute('aria-hidden', 'true')
    item.setAttribute('aria-expanded', String(!item.parentElement?.classList.contains('collapsed')))
    if (!keyboardReady.has(item)) {
      item.addEventListener('keydown', event => {
        if ((event as KeyboardEvent).key === ' ') {
          event.preventDefault()
          ;(item as HTMLElement).click()
        }
      })
      keyboardReady.add(item)
    }
  })
}

function observeSidebar() {
  sidebarObserver?.disconnect()
  normalizeSidebarControls()
  const sidebar = document.querySelector('.VPSidebar')
  if (!sidebar) return
  sidebarObserver = new MutationObserver(normalizeSidebarControls)
  sidebarObserver.observe(sidebar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'role', 'tabindex'] })
}

onMounted(observeSidebar)
watch(() => page.value.relativePath, () => nextTick(() => { observeSidebar() }))
onBeforeUnmount(() => { sidebarObserver?.disconnect() })
</script>

<template>
  <div class="atlas-shell" :class="{ 'atlas-home-shell': isHome, 'atlas-path-shell': isPath }">
  <div v-if="!isHome" class="reading-progress" aria-hidden="true"><span></span></div>
  <Layout>
    <template #not-found>
      <main class="missing-page">
        <span>404</span>
        <h1>这一页没有收录</h1>
        <p>可以用章节名在知识目录中查找，或回到首页重新选读。</p>
        <a :href="withBase('/catalog')">查找文章 →</a>
        <a :href="withBase('/')">回到知序首页</a>
      </main>
    </template>
    <template #home-hero-before><HomePage /></template>
    <template #doc-before><ArticleMeta /></template>
  </Layout>
  </div>
</template>
