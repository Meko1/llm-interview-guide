<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { data as routeStages } from '../routeStages.data'
import AtlasIcon from './AtlasIcon.vue'

const { page } = useData()
const route = computed(() => page.value.relativePath.split('/').pop()?.replace(/\.md$/, '') ?? '')
const stages = computed(() => routeStages[route.value] ?? [])
const selected = ref(0)
const current = computed(() => stages.value[selected.value] ?? stages.value[0])
watch(route, () => { selected.value = 0 })
</script>

<template>
  <section v-if="current" class="path-journey" :aria-label="route === 'frontier' ? '论文选读' : '阶段自测'">
    <div class="journey-header">
      <h2>{{ route === 'frontier' ? '选一篇论文，追问它的证据' : '阶段自测' }}</h2>
    </div>
    <div class="journey-stages">
      <button v-for="(stage, index) in stages" :key="stage.title" type="button"
        :aria-pressed="selected === index" :class="{ active: selected === index }" @click="selected = index">
        <span class="journey-point">{{ index + 1 }}</span><strong>{{ stage.title }}</strong>
      </button>
    </div>
    <div class="journey-detail" aria-live="polite">
      <div><h3>{{ current.question }}</h3><p>练习产出 · {{ current.output }}</p></div>
      <a class="guide-button" :href="withBase(current.link)">{{ current.reading }}<AtlasIcon /></a>
    </div>
  </section>
</template>
