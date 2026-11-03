<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import records from '../../../_data/pages.json'
import { levels } from '../learning'

const { page, frontmatter } = useData()
const record = computed(() => records.find(item => item.path === page.value.relativePath))
const levelName = computed(() => levels.find(item => item.id === frontmatter.value.level)?.name)
</script>

<template>
  <section v-if="frontmatter.level && record" class="article-meta" aria-label="文章阅读信息">
    <div class="article-meta-main">
      <span class="level-badge">{{ frontmatter.level }} {{ levelName }}</span>
      <span>{{ frontmatter.roles?.join(' / ') }}</span>
      <span>约 {{ record.readingMinutes }} 分钟</span>
    </div>
    <a :href="withBase('/reading-guide')">{{ frontmatter.classification === 'reviewed' ? '已核分级' : '初次分级 · 待核实' }} ↗</a>
  </section>
</template>
