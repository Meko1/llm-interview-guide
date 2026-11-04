<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import AtlasIcon from './AtlasIcon.vue'
const nodes = [
  { id: 'models', title: '理解模型', label: 'Transformer / Attention', description: '沿 token 数据流理解结构、掩码与计算边界。', link: '/basics/transformer', position: [22, 23], level: 'L0 → L2' },
  { id: 'rag', title: '组织知识', label: 'Retrieval / Evidence', description: '从文档到证据，定位检索、上下文与引用的失败。', link: '/rag/rag-basics', position: [73, 18], level: 'L1 → L2' },
  { id: 'agent', title: '执行任务', label: 'Tools / State / Safety', description: '用受控状态与工具，把动态决策变成可靠行动。', link: '/agent/agent-basics', position: [78, 72], level: 'L1 → L3' },
  { id: 'infra', title: '优化推理', label: 'KV Cache / Serving', description: '复算显存、理解调度，在质量、延迟与成本之间判断。', link: '/inference/kv-cache', position: [22, 77], level: 'L2 → L3' },
  { id: 'evaluate', title: '验证能力', label: 'Evaluation / Trade-offs', description: '固定基线、保留失败，证明改变带来了什么。', link: '/evaluation/evaluation', position: [50, 49], level: '贯穿全路径' }
]
const selected = ref('models')
const current = computed(() => nodes.find(node => node.id === selected.value) || nodes[0])
const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]]
</script>
<template>
  <div class="capability-map">
    <div class="map-canvas" aria-label="能力地图：选择节点查看学习入口">
      <svg class="map-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line v-for="(edge, index) in edges" :key="index" :x1="nodes[edge[0]].position[0]" :y1="nodes[edge[0]].position[1]" :x2="nodes[edge[1]].position[0]" :y2="nodes[edge[1]].position[1]" :class="{ connected: edge.some(endpoint => nodes[endpoint].id === selected) }" /><circle cx="50" cy="49" r="25" class="map-orbit" /></svg>
      <button v-for="node in nodes" :key="node.id" class="map-node" :class="{ selected: selected === node.id, center: node.id === 'evaluate' }" :style="{ left: node.position[0] + '%', top: node.position[1] + '%' }" type="button" :aria-pressed="selected === node.id" @click="selected = node.id"><span class="map-node-dot"></span><strong>{{ node.title }}</strong><span class="map-node-label">{{ node.label }}</span><span class="map-node-level">{{ node.level }}</span></button>
    </div>
    <div class="map-caption" aria-live="polite"><div><span class="map-caption-level">{{ current.level }}</span><p>{{ current.description }}</p></div><a :href="withBase(current.link)" :aria-label="'开始学习：' + current.title">开始探索<AtlasIcon /></a></div>
  </div>
</template>
