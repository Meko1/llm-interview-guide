<script setup lang="ts">
const stats = [
  { num: '65+', label: '深度文章' },
  { num: '11', label: '大板块' },
  { num: '12', label: '万字旗舰长文' },
  { num: '数百', label: '高频面试追问' }
]

const personas = [
  { emoji: '🎓', title: '应届 / 在校生', desc: '从零基础导引到面试速记，循序渐进系统入门，没接触过 AI 也能跟上。' },
  { emoji: '💼', title: '后端 / 工程师转型', desc: '复用你的工程经验，重点补齐大模型特有范式与落地，最快上手应用方向。' },
  { emoji: '🧪', title: '算法 / 研究方向', desc: '原理深挖 + 前沿专题 + 手撕题，扛住对 Transformer、训练、对齐的连环追问。' },
  { emoji: '🚀', title: 'AI 应用开发者', desc: 'RAG、Agent、工程实战与系统设计，把模型能力做成可上线的产品。' }
]
</script>

<template>
  <div class="home-extras">
    <!-- 数据 band -->
    <div class="he-stats">
      <div v-for="s in stats" :key="s.label" class="he-stat">
        <div class="he-stat-num">{{ s.num }}</div>
        <div class="he-stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- 适合人群 -->
    <h2 class="he-section-title">👥 适合谁看</h2>
    <p class="he-section-sub">无论你处在哪个阶段，都能在这里找到适合自己的学习与备战路径</p>
    <div class="he-persona-grid">
      <div v-for="p in personas" :key="p.title" class="he-persona">
        <div class="he-persona-emoji">{{ p.emoji }}</div>
        <div class="he-persona-title">{{ p.title }}</div>
        <div class="he-persona-desc">{{ p.desc }}</div>
      </div>
    </div>
  </div>
</template>
