<script setup lang="ts">
import { computed, ref } from 'vue'
import { calculateDpoPair, calculateLoraBudget } from './lessonMath'

defineProps<{ kind: 'lora' | 'dpo'; step: number }>()
defineEmits<{ interaction: [] }>()
const rank = ref(8)
const outputWidth = ref(4096)
const alpha = ref(16)
const margin = ref(2)
const beta = ref(0.1)
const budget = computed(() => calculateLoraBudget(4096, outputWidth.value, rank.value, alpha.value))
const pair = computed(() => calculateDpoPair(margin.value, beta.value))
const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value)
</script>

<template>
  <div class="finetuning-diagram">
    <template v-if="kind === 'lora'">
      <div class="lab-options tune-options">
        <label>Rank r <select v-model.number="rank" @change="$emit('interaction')"><option v-for="value in [4, 8, 16, 32, 64]" :key="value" :value="value">{{ value }}</option></select></label>
        <label>输出维度 <select v-model.number="outputWidth" @change="$emit('interaction')"><option :value="4096">4096（方阵）</option><option :value="11008">11008（非方阵）</option></select></label>
        <label>Alpha <select v-model.number="alpha" @change="$emit('interaction')"><option v-for="value in [8, 16, 32]" :key="value" :value="value">{{ value }}</option></select></label>
      </div>
      <div class="lora-architecture">
        <div class="tune-matrix base-matrix">
          <span class="tune-eyebrow">基座 · 始终冻结</span><strong>W</strong>
          <div class="matrix-grid" aria-hidden="true"><span v-for="cell in 36" :key="cell"></span></div>
          <span class="matrix-shape">{{ outputWidth }} × 4096</span>
          <small>{{ formatCount(budget.baseParameters) }} 个基座参数</small>
        </div>
        <div class="adapter-branch" :class="{ enabled: step >= 1, training: step === 3 }">
          <span class="tune-eyebrow">{{ step === 3 ? '只更新这条分支' : '低秩分支 · 可训练' }}</span>
          <div class="adapter-matrix"><strong>A</strong><span>{{ rank }} × 4096</span><div class="matrix-slats" aria-hidden="true"><span v-for="cell in 4" :key="cell"></span></div></div>
          <span class="branch-connector" aria-hidden="true">↓</span>
          <div class="adapter-matrix"><strong>B</strong><span>{{ outputWidth }} × {{ rank }}</span><div class="matrix-slats vertical" aria-hidden="true"><span v-for="cell in 4" :key="cell"></span></div></div>
        </div>
        <div class="tune-result" :class="{ enabled: step >= 2 }">
          <span class="tune-eyebrow">{{ step === 4 ? '合并后的线性权重' : '前向路径' }}</span>
          <strong>{{ step === 4 ? 'W + sBA' : 'Wx + sB(Ax)' }}</strong>
          <span class="tune-scale">s = alpha/r = {{ budget.scale.toFixed(2) }}</span>
          <div class="tune-signal" aria-hidden="true"><span :style="{ transform: 'scaleX(' + step / 4 + ')' }"></span></div>
          <small>{{ step === 4 ? '精度、量化与适配器配置仍需核对' : step < 2 ? '选择前向阶段，观察两路相加' : '冻结基座与低秩增量一起参与输出' }}</small>
        </div>
      </div>
      <div class="tune-ledger" aria-live="polite">
        <div><span>A/B 可训练参数</span><strong data-budget="parameters">{{ formatCount(budget.adapterParameters) }}</strong></div>
        <div><span>相对单层 W 的参数量</span><strong data-budget="fraction">{{ budget.fractionPercent.toFixed(3) }}%</strong></div>
        <div><span>仅 BF16 适配器权重</span><strong data-budget="storage">{{ budget.adapterMiB.toFixed(3) }} <small>MiB</small></strong></div>
      </div>
      <p class="tune-boundary">参数公式：r × (d_in + d_out)。这是一个线性层的账本，不是整模占比或训练显存估计；格子只表示矩阵关系，不按维度比例绘制。</p>
    </template>

    <template v-else>
      <div class="lab-options tune-options">
        <label>参考校正差值 Δ <input v-model.number="margin" type="range" min="-2" max="2" step="0.25" @input="$emit('interaction')" /><output>{{ margin.toFixed(2) }}</output></label>
        <label>Beta <input v-model.number="beta" type="range" min="0.05" max="1" step="0.05" @input="$emit('interaction')" /><output>{{ beta.toFixed(2) }}</output></label>
      </div>
      <div class="dpo-pair">
        <div v-for="answer in ['chosen', 'rejected']" :key="answer" class="preference-answer" :class="{ enabled: step >= 2 }">
          <span class="tune-eyebrow">同一 prompt · 构造偏好对</span><strong>{{ answer === 'chosen' ? 'chosen · 更受偏好' : 'rejected · 较少受偏好' }}</strong>
          <dl><div><dt>参考 log-prob</dt><dd>{{ step >= 1 ? (answer === 'chosen' ? pair.referenceChosen : pair.referenceRejected).toFixed(2) : '待展示' }}</dd></div><div><dt>策略 log-prob</dt><dd>{{ step >= 2 ? (answer === 'chosen' ? pair.policyChosen : pair.policyRejected).toFixed(2) : '待展示' }}</dd></div></dl>
          <div class="delta-readout"><span>策略 − 参考</span><strong>{{ step >= 3 ? (answer === 'chosen' ? pair.chosenGain : pair.rejectedGain).toFixed(2) : '待展示' }}</strong></div>
          <div class="delta-track" aria-hidden="true"><span :class="{ negative: (answer === 'chosen' ? pair.chosenGain : pair.rejectedGain) < 0 }" :style="{ transform: 'scaleX(' + (step >= 3 ? Math.abs(answer === 'chosen' ? pair.chosenGain : pair.rejectedGain) : 0) + ')' }"></span></div>
        </div>
      </div>
      <div class="dpo-equation" :class="{ enabled: step >= 4 }" aria-live="polite">
        <div><span>β × Δ</span><strong data-dpo="logit">{{ step >= 3 ? pair.logit.toFixed(4) : '待展示' }}</strong></div>
        <span class="equation-arrow" aria-hidden="true">→</span>
        <div><span>softplus(−β × Δ)</span><strong data-dpo="loss">{{ step >= 4 ? pair.loss.toFixed(6) : '待展示' }}</strong></div>
      </div>
      <p class="tune-boundary">调节 Δ 让两条构造策略 log-prob 对称变化，参考保持固定；正负条表示相对增益。真实更新不一定让 chosen 的绝对概率上升，也不能把更低损失当作事实性或安全性的证明。</p>
    </template>
  </div>
</template>
