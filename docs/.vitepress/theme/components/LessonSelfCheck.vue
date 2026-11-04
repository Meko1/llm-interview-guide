<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import AtlasIcon from './AtlasIcon.vue'
import { selfChecks } from './selfChecks'
import type { LessonKind } from './selfChecks'

const props = defineProps<{ kind: LessonKind }>()
const emit = defineEmits<{ interaction: [] }>()
const questions = computed(() => selfChecks[props.kind])

function handleToggle(event: Event) {
  const details = event.currentTarget as HTMLDetailsElement
  if (details.open) emit('interaction')
}
</script>

<template>
  <section class="lesson-self-check" aria-label="分层自测">
    <div class="self-check-heading"><span class="self-check-kicker">SELF CHECK</span><h2>看懂了，试着讲清楚。</h2><p>按你的阅读深度选题，先独立口述，再展开对照。不自动评分，也不把查看答案算作掌握。</p></div>
    <div class="self-check-questions">
      <details v-for="question in questions" :key="kind + question.level" class="self-check-question" @toggle="handleToggle">
        <summary><span class="self-check-level">{{ question.level }}<small>{{ question.focus }}</small></span><strong>{{ question.question }}</strong><AtlasIcon :size="18" /></summary>
        <div class="self-check-answer">
          <div class="self-check-reasoning"><h3>参考思路</h3><p>{{ question.answer }}</p></div>
          <div class="self-check-evidence"><h3>核对你的回答</h3><ul><li v-for="item in question.evidence" :key="item">{{ item }}</li></ul></div>
          <p class="self-check-pitfall"><strong>别跳过边界</strong>{{ question.pitfall }}</p>
          <a class="self-check-reference" :href="withBase(question.href)">回到正文 · {{ question.reference }}<AtlasIcon name="expand" :size="15" /></a>
        </div>
      </details>
    </div>
    <p class="self-check-note">这些是基于本文整理的参考思路，不是唯一答案。请结合假设、证据和实现条件说明你的判断。</p>
  </section>
</template>
