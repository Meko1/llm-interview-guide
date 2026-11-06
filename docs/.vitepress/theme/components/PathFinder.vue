<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { paths } from '../learning'

withDefaults(defineProps<{ headingLevel?: 2 | 3 }>(), { headingLevel: 3 })

const target = ref('application')
const foundation = ref('api')
const time = ref('steady')
const capabilityLink = computed(() => '/capability-map?role=' + target.value + '&foundation=' + foundation.value)
const recommendation = computed(() => target.value === 'infra'
  ? { title: '推理与 Infra', link: '/paths/infra', output: '交付：容量估算与压测报告' }
  : paths.find(path => path.id === target.value) || paths[2])
const startingPoint = computed(() => {
  if (foundation.value === 'new') return { title: '先补模型直觉与最小实践', link: '/beginner/getting-started' }
  if (target.value === 'infra') return { title: '从 KV 显存账本开始', link: '/inference/kv-cache' }
  if (target.value === 'research') return foundation.value === 'production'
    ? { title: '从训练机制与实验边界开始', link: '/advanced/training-internals' }
    : { title: '从 Attention 的形状与推导开始', link: '/basics/attention' }
  if (target.value === 'student') return { title: '从 Transformer 数据流开始', link: '/basics/transformer' }
  return foundation.value === 'production'
    ? { title: '从工程决策与失败分析开始', link: '/engineering/system-design' }
    : { title: '先做 RAG 基线与分段评测', link: '/rag/rag-basics' }
})
const pace = computed(() => ({ sprint: '两周内冲刺：先完成核心复述、一个项目证据和失败分析，不承诺覆盖全站。', steady: '每周约 5 小时：按路线逐阶段推进，实践耗时另计。', deep: '持续深入：为每个阶段增加复算、对照实验与复盘，不急于刷完页面。' })[time.value])
</script>

<template>
  <section class="path-finder" aria-label="学习路径推荐">
    <div class="finder-fields">
      <label>你的目标
        <select v-model="target">
          <option v-for="path in paths" :key="path.id" :value="path.id">{{ path.title }}</option>
          <option value="infra">推理与 Infra</option>
        </select>
      </label>
      <label>当前基础
        <select v-model="foundation">
          <option value="new">刚开始，想先理解概念</option>
          <option value="api">已能调用 API、搭建 Demo</option>
          <option value="production">有服务或训练工程经验</option>
        </select>
      </label>
      <label>可用时间
        <select v-model="time">
          <option value="sprint">两周内准备面试</option>
          <option value="steady">每周约 5 小时</option>
          <option value="deep">有时间持续深入</option>
        </select>
      </label>
    </div>
    <div class="finder-result" aria-live="polite" aria-atomic="true">
      <div>
        <component :is="`h${headingLevel}`" class="finder-result-title">{{ recommendation.title }}</component>
        <p>{{ recommendation.output }}。{{ pace }}</p>
        <a :href="withBase(startingPoint.link)">{{ startingPoint.title }} →</a>
        <a class="finder-capability-link" :href="withBase(capabilityLink)">用情境自查核对起点与前置 →</a>
      </div>
      <a class="guide-button" :href="withBase(recommendation.link)">进入推荐路线 →</a>
    </div>
  </section>
</template>
