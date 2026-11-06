<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import AtlasIcon from './AtlasIcon.vue'
import { declarationOptions, foundations, getCapability, goals, initialDeclarations, parseMapContext, prerequisiteOrder, recommendCapability } from '../capabilities'
import type { CapabilityId, FoundationId, GoalId } from '../capabilities'

const goalId = ref<GoalId>('application')
const foundationId = ref<FoundationId>('api')
const declarations = ref(initialDeclarations())
const selectedId = ref<CapabilityId>('foundations')
const goal = computed(() => goals.find(goal => goal.id === goalId.value)!)
const foundation = computed(() => foundations.find(foundation => foundation.id === foundationId.value)!)
const selected = computed(() => getCapability(selectedId.value))
const nodes = computed(() => goal.value.route.map(getCapability))
const recommendedId = computed(() => recommendCapability(goalId.value, declarations.value))
const pendingPrerequisites = computed(() => prerequisiteOrder(selectedId.value).filter(id => declarations.value[id] !== 'evidence'))
const recommendation = computed(() => {
  if (!recommendedId.value) return '你已为这条路线的节点声明可展示证据。下一步是把证据串成项目复盘；这不是系统确认掌握或通过评估。'
  const capability = getCapability(recommendedId.value)
  return declarations.value[capability.id] === 'explain'
    ? '你声明能解释「' + capability.title + '」，还缺实践证据。建议先交付对应任务，再继续扩展。'
    : '「' + capability.title + '」是当前路线里第一个尚待自查或验证的节点。先核对情境与前置，避免把文章浏览当成能力证明。'
})

function changeGoal() { selectedId.value = recommendedId.value || goal.value.route[0] }
function reset() { declarations.value = initialDeclarations(); selectedId.value = goal.value.route[0] }
onMounted(() => {
  const context = parseMapContext(window.location.search)
  goalId.value = context.goal
  foundationId.value = context.foundation
  changeGoal()
})
</script>

<template>
  <section class="capability-planner" aria-label="岗位能力定位">
    <div class="planner-context">
      <div class="planner-context-title"><span class="planner-kicker">YOUR NEXT STEP</span><h2>从你的目标，找到下一步。</h2><p>先声明，再验证。这里没有自动评分与掌握进度条。</p></div>
      <div class="planner-fields">
        <label>目标方向<select v-model="goalId" @change="changeGoal"><option v-for="item in goals" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
        <label>当前基础<select v-model="foundationId"><option v-for="item in foundations" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
      </div>
      <p class="planner-foundation">{{ foundation.note }}</p>
    </div>

    <div class="planner-recommendation">
      <div><span class="planner-kicker">建议下一步 · 不锁定阅读</span><p role="status">{{ recommendation }}</p></div>
      <button v-if="recommendedId" type="button" class="guide-button" @click="selectedId = recommendedId">查看{{ getCapability(recommendedId).title }}<AtlasIcon :size="17" /></button>
      <a v-else class="guide-button" :href="withBase(goal.href)">整理路线证据<AtlasIcon :size="17" /></a>
    </div>

    <div class="planner-workspace">
      <div class="planner-route">
        <div class="planner-route-heading"><span>{{ goal.level }}</span><h2>{{ goal.title }}</h2><p>{{ goal.focus }}</p></div>
        <ol class="planner-nodes" aria-label="目标能力路线">
          <li v-for="(node, index) in nodes" :key="node.id">
            <button type="button" :class="{ selected: selectedId === node.id }" :aria-pressed="selectedId === node.id" @click="selectedId = node.id">
              <span class="planner-node-number">{{ index + 1 }}</span><span class="planner-node-text"><strong>{{ node.title }}</strong><small>{{ node.level }}</small><span>{{ declarationOptions.find(option => option.id === declarations[node.id])?.title }}</span></span><AtlasIcon :size="16" />
            </button>
          </li>
        </ol>
        <p class="planner-route-note">连线表示建议阅读次序，具体前置以能力面板说明为准。切换目标保留当前页的自查声明，刷新后清空。</p>
        <a class="planner-detail-jump" href="#capability-detail">查看当前节点的自查与证据<AtlasIcon :size="15" /></a>
        <a :href="withBase(goal.href)" class="planner-inline">查看完整岗位路线<AtlasIcon name="expand" :size="15" /></a>
      </div>

      <section id="capability-detail" class="planner-detail" :key="selectedId" aria-label="当前能力与实践证据">
        <div class="planner-detail-heading"><span class="planner-kicker">{{ selected.level }} · 当前探索节点</span><h2>{{ selected.title }}</h2><p>{{ selected.intent }}</p></div>
        <div class="planner-prerequisites"><h3>先核对前置</h3><p v-if="!selected.prerequisites.length">这是模型主线的起点。刚入门时仍需先确认 Python 等基础，不能跳过实际前置。</p><div v-else class="planner-prerequisite-links"><button v-for="id in selected.prerequisites" :key="id" type="button" @click="selectedId = id">{{ getCapability(id).title }}<span>{{ declarations[id] === 'evidence' ? '已声明有证据' : '尚需核对' }}</span><AtlasIcon :size="14" /></button></div><p v-if="pendingPrerequisites.length" class="planner-pending">还有前置需要核对：{{ pendingPrerequisites.map(id => getCapability(id).title).join('、') }}。这是建议，不会阻止你阅读当前节点。</p></div>

        <div class="planner-scenario"><h3>先回答这个情境</h3><p>{{ selected.scenario }}</p><details><summary>展开回答核对点</summary><ul><li v-for="check in selected.checks" :key="check">{{ check }}</li></ul><p>{{ selected.boundary }}</p></details></div>
        <fieldset class="planner-declaration"><legend>你对这项能力的声明</legend><label v-for="option in declarationOptions" :key="option.id"><input v-model="declarations[selectedId]" type="radio" :value="option.id" name="capability-declaration" /><span>{{ option.title }}</span></label><p>系统不验证你的回答。声明“可展示证据”后推荐会推进，请先核对下方清单。</p></fieldset>

        <div class="planner-practice"><span class="planner-kicker">学习 → 实践 → 证据</span><h3>交付一份可核查的产出</h3><p>{{ selected.practice }}</p><ul><li v-for="item in selected.evidence" :key="item"><AtlasIcon name="check" :size="16" /><span>{{ item }}</span></li></ul></div>
        <div class="planner-readings"><h3>回到原理与自测</h3><a v-for="reading in selected.readings" :key="reading.href" :href="withBase(reading.href)">{{ reading.title }}<AtlasIcon name="expand" :size="16" /></a></div>
      </section>
    </div>
    <div class="planner-footer"><p>不上传、不持久化。清空会重置所有节点声明，保留目标与基础。</p><button type="button" @click="reset"><AtlasIcon name="reset" :size="16" />清空自查声明</button></div>
  </section>
</template>
