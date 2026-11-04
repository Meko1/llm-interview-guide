<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import AtlasIcon from './AtlasIcon.vue'
const { page } = useData()
const selected = ref(0)
const stages = computed(() => {
  const route = page.value.relativePath
  if (route.includes('research') || route.includes('frontier')) return [
    { title: '建立机制', note: '从数据流和目标函数理解模型，而非先记结论。', output: '产出：张量形状与训练目标笔记', link: '/basics/attention', reading: 'Attention 的形状与推导' },
    { title: '阅读一手资料', note: '区分论文贡献、训练配置与工程外推。', output: '产出：假设、基线和实验边界卡片', link: '/advanced/training-internals', reading: '训练机制与实验边界' },
    { title: '设计对照实验', note: '固定数据与预算，只改变一个关键因素。', output: '产出：基线、消融和失败分析', link: '/evaluation/evaluation', reading: '评测与实验设计' },
    { title: '解释与复盘', note: '讲清收益、代价和未解决的问题。', output: '产出：可复核的实验报告', link: '/paths/frontier', reading: '前沿贡献判断' }
  ]
  if (route.includes('infra')) return [
    { title: '算清资源', note: '分清权重、缓存、激活与工作区。', output: '产出：配置明确的显存账本', link: '/inference/kv-cache', reading: 'KV Cache 容量与交互复算' },
    { title: '理解执行', note: '区分 prefill、decode 与调度约束。', output: '产出：请求链路与瓶颈假设', link: '/inference/serving-frameworks', reading: '推理服务与部署' },
    { title: '测量与对照', note: '按真实长度和并发分布记录吞吐、延迟与失败。', output: '产出：基线与压测报告', link: '/evaluation/evaluation', reading: '如何建立评测' },
    { title: '决策与回滚', note: '质量、成本与可靠性一起评估。', output: '产出：容量决策和回滚边界', link: '/engineering/system-design', reading: '应用系统设计' }
  ]
  return [
    { title: '建立原理', note: '从一个 token 开始，理解模型怎样生成下一步。', output: '产出：能解释的模型数据流', link: '/basics/transformer', reading: 'Transformer 交互图解' },
    { title: '构建 RAG', note: '让资料进入回答，保留来源、候选与失败证据。', output: '产出：最小检索基线与问答 trace', link: '/rag/rag-basics', reading: 'RAG 基础与完整流程' },
    { title: '约束行动', note: '用工具契约、权限与状态管理实现可恢复任务。', output: '产出：有停止条件的 Agent', link: '/agent/agent-basics', reading: 'Agent 的行动与恢复' },
    { title: '验证能力', note: '固定问题集，解释一次优化带来的收益与代价。', output: '产出：对照实验与项目复述', link: '/evaluation/evaluation', reading: '评测与质量门禁' }
  ]
})
const current = computed(() => stages.value[selected.value])
watch(() => page.value.relativePath, () => { selected.value = 0 })
</script>
<template><section class="path-journey" aria-label="学习阶段预览"><div class="journey-header"><h2>把知识，变成一段可执行的路径。</h2><p>选择阶段查看任务；进度只是路线位置，不代表已经掌握。</p></div><div class="journey-stages"><button v-for="(stage, index) in stages" :key="stage.title" type="button" :aria-pressed="selected === index" :class="{ active: selected === index }" @click="selected = index"><span class="journey-point">{{ index + 1 }}</span><strong>{{ stage.title }}</strong></button></div><div class="journey-detail" aria-live="polite"><div><h3>{{ current.title }}</h3><p>{{ current.note }}</p><span>{{ current.output }}</span></div><a class="guide-button" :href="withBase(current.link)">{{ current.reading }}<AtlasIcon /></a></div></section></template>
