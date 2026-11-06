<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import records from '../../../_data/pages.json'
import { levels } from '../learning'
import AtlasIcon from './AtlasIcon.vue'

const { page, frontmatter } = useData()
const record = computed(() => records.find(item => item.path === page.value.relativePath))
const levelName = computed(() => levels.find(item => item.id === frontmatter.value.level)?.name)
const readerRoles = computed(() => Array.isArray(frontmatter.value.roles) ? frontmatter.value.roles.join(' · ') : '')
</script>

<template>
  <section v-if="frontmatter.level && record" class="article-meta" aria-label="文章阅读信息">
    <div class="article-meta-copy">
      <div class="article-meta-main">
        <span class="level-badge">{{ frontmatter.level }} {{ levelName }}</span>
        <span>{{ record.section }}</span>
        <span class="article-time"><AtlasIcon name="clock" :size="15" />阅读量估算 {{ record.readingMinutes }} 分钟</span>
      </div>
      <p v-if="readerRoles" class="article-meta-readers">适合读者：<span>{{ readerRoles }}</span></p>
    </div>
    <a :href="withBase('/reading-guide')">{{ frontmatter.classification === 'reviewed' ? '已核分级 · 查看阅读说明' : '分级待核 · 查看阅读说明' }} ↗</a>
  </section>
</template>
