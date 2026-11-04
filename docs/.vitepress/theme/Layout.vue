<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import HomePage from './components/HomePage.vue'
import ArticleMeta from './components/ArticleMeta.vue'

const { Layout } = DefaultTheme
const { page } = useData()
const isHome = computed(() => page.value.relativePath === 'index.md')
const isPath = computed(() => page.value.relativePath.startsWith('paths/'))
const readingProgress = ref(0)
function updateProgress() {
  const distance = document.documentElement.scrollHeight - window.innerHeight
  readingProgress.value = distance > 0 ? Math.min(100, Math.max(0, window.scrollY / distance * 100)) : 0
}
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

onMounted(() => { observeSidebar(); window.addEventListener('scroll', updateProgress, { passive: true }); window.addEventListener('resize', updateProgress); updateProgress() })
watch(() => page.value.relativePath, () => nextTick(() => { observeSidebar(); updateProgress() }))
onBeforeUnmount(() => { sidebarObserver?.disconnect(); window.removeEventListener('scroll', updateProgress); window.removeEventListener('resize', updateProgress) })
</script>

<template>
  <div class="atlas-shell" :class="{ 'atlas-home-shell': isHome, 'atlas-path-shell': isPath }">
  <div v-if="!isHome" class="reading-progress" aria-hidden="true"><span :style="{ width: readingProgress + '%' }"></span></div>
  <Layout>
    <template #home-hero-before><HomePage /></template>
    <template #doc-before><ArticleMeta /></template>
  </Layout>
  </div>
</template>
