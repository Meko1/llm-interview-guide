<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { withBase, useRouter } from 'vitepress'
import records from '../../../_data/pages.json'
import { levels } from '../learning'

const articles = records.filter(page => page.article)
const level = ref('')
const role = ref('')
const section = ref('')
const query = ref('')
const sections = [...new Set(articles.map(page => page.section))]
const filtered = computed(() => articles.filter(page =>
  (!level.value || page.level === level.value) &&
  (!role.value || page.roles.includes(role.value)) &&
  (!section.value || page.section === section.value) &&
  (!query.value.trim() || `${page.title} ${page.description}`.toLowerCase().includes(query.value.trim().toLowerCase()))))
const groups = computed(() => sections.map(name => ({ name, pages: filtered.value.filter(page => page.section === name) })).filter(group => group.pages.length))
const reset = () => { level.value = ''; role.value = ''; section.value = ''; query.value = '' }
function readFilters() {
  const params = new URLSearchParams(window.location.search)
  section.value = sections.includes(params.get('section') || '') ? params.get('section')! : ''
  level.value = levels.some(item => item.id === params.get('level')) ? params.get('level')! : ''
  role.value = ['在校生', '后端转型', '应用开发', '算法研究', 'Infra'].includes(params.get('role') || '') ? params.get('role')! : ''
  query.value = params.get('q') || ''
}
const router = useRouter()
let previousAfterRoute: typeof router.onAfterRouteChanged
const syncAfterRoute: NonNullable<typeof router.onAfterRouteChanged> = async (to) => {
  await previousAfterRoute?.(to)
  readFilters()
}
onMounted(() => {
  readFilters()
  previousAfterRoute = router.onAfterRouteChanged
  router.onAfterRouteChanged = syncAfterRoute
  window.addEventListener('popstate', readFilters)
})
onBeforeUnmount(() => {
  if (router.onAfterRouteChanged === syncAfterRoute) router.onAfterRouteChanged = previousAfterRoute
  window.removeEventListener('popstate', readFilters)
})
watch([section, level, role, query], () => {
  const url = new URL(window.location.href)
  for (const [key, value] of [['section', section.value], ['level', level.value], ['role', role.value], ['q', query.value]]) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  window.history.replaceState(window.history.state, '', url)
})

</script>

<template>
  <section class="article-catalog" aria-label="文章筛选">
    <details class="catalog-disclosure">
      <summary>筛选文章</summary>
      <div class="catalog-filters">
      <label class="catalog-query">关键词<input v-model="query" type="search" placeholder="试试 KV Cache、评测、工具安全" /></label>
      <label>主阅读级别<select v-model="level"><option value="">全部级别</option><option v-for="item in levels" :key="item.id" :value="item.id">{{ item.id }} {{ item.name }}</option></select></label>
      <label>目标岗位<select v-model="role"><option value="">全部岗位</option><option v-for="name in ['在校生', '后端转型', '应用开发', '算法研究', 'Infra']" :key="name">{{ name }}</option></select></label>
      <label>知识板块<select v-model="section"><option value="">全部板块</option><option v-for="name in sections" :key="name">{{ name }}</option></select></label>
    </div>
    </details>
    <div class="catalog-status"><p role="status">{{ section || '全部主题' }} · {{ filtered.length }} 篇文章</p><button type="button" @click="reset">清除筛选</button></div>

    <p v-if="level === 'L4'" class="catalog-note">现有研究文章以 L3 背景阅读为主，不自动标成前沿。L4 读者可以从 <a :href="withBase('/paths/frontier')">贡献判断与开放问题路线</a> 开始。</p>
    <div v-if="!groups.length" class="catalog-empty"><h2>暂时没有匹配的文章</h2><p>试着减少一个筛选条件，或用顶部搜索查找正文中的概念。</p><button type="button" class="guide-button" @click="reset">查看全部文章</button></div>
    <section v-for="group in groups" :key="group.name" class="catalog-group">
      <h2>{{ group.name }} <span>{{ group.pages.length }} 篇</span></h2>
      <ul class="catalog-list">
        <li v-for="page in group.pages" :key="page.path">
          <a :href="withBase(page.url)">{{ page.title }}</a>
          <p class="catalog-description">{{ page.description }}</p>
          <span class="catalog-meta">{{ page.level }} · 约 {{ page.readingMinutes }} 分钟 · {{ page.classification === 'reviewed' ? '已核分级' : '初次分级' }}</span>
        </li>
      </ul>
    </section>
    <p class="catalog-note">分级为主阅读门槛，不代表整篇难度一致。初次分级仍待人工核实；阅读时长不含实践。<a :href="withBase('/reading-guide')">了解口径 →</a></p>
  </section>
</template>
