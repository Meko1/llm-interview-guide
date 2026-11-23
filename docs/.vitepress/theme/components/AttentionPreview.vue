<script setup lang="ts">
import { ref } from 'vue'

// Positions refer to an illustrative sequence of four tokens in a causal decoder.
const length = 4
const selected = ref(3)
</script>

<template>
  <figure class="mask-plate">
    <figcaption>
      <strong>因果注意力掩码</strong>
      <span lang="en">Causal mask</span>
    </figcaption>
    <div class="mask-matrix" role="group" aria-label="选择查询位置">
      <div class="mask-keys" aria-hidden="true">
        <span></span><span v-for="k in length" :key="k">K{{ k }}</span>
      </div>
      <button
        v-for="q in length"
        :key="q"
        type="button"
        class="mask-row"
        :aria-label="`查询位置 ${q}，可读取前 ${q} 个位置`"
        :aria-pressed="q === selected"
        @click="selected = q"
      >
        <span class="mask-query">Q{{ q }}</span>
        <span v-for="k in length" :key="k" class="mask-tile" :class="{ blocked: k > q }" aria-hidden="true"></span>
      </button>
    </div>
    <p aria-live="polite">Q{{ selected }} 可以读取 {{ selected === 1 ? 'K1' : `K1 至 K${selected}` }}。斜线表示屏蔽的位置。</p>
  </figure>
</template>
