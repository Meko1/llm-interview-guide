<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import HomePage from './components/HomePage.vue'
import ArticleMeta from './components/ArticleMeta.vue'

const { Layout } = DefaultTheme
const { page } = useData()
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
watch(() => page.value.relativePath, () => nextTick(observeSidebar))
onBeforeUnmount(() => sidebarObserver?.disconnect())
</script>

<template>
  <Layout>
    <template #home-hero-before><HomePage /></template>
    <template #doc-before><ArticleMeta /></template>
  </Layout>
</template>
