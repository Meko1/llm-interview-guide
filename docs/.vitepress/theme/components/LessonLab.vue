<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AtlasIcon from './AtlasIcon.vue'
import FinetuningDiagram from './FinetuningDiagram.vue'
import LessonSelfCheck from './LessonSelfCheck.vue'
import type { LessonKind } from './selfChecks'
const props = defineProps<{ kind: LessonKind }>()
const step = ref(0)
const playing = ref(false)
const reducedMotion = ref(false)
const causal = ref(true)
const promptLength = ref(2048)
const kvHeads = ref(8)
const timeout = ref(true)
const outdated = ref(true)
let timer: ReturnType<typeof setInterval> | undefined
let motionQuery: MediaQueryList | undefined
const content = {
  lora: { title: '冻结大矩阵，训练一条低秩分支。', note: '标准 LoRA、无偏置单线性层示意；d_in=4096，权重按 BF16 的 2 字节计。格子不是实际权重，预算不含梯度、优化器和激活。', steps: ['冻结 W', '低秩 A/B', '前向相加', '训练分支', '部署合并'], explanations: ['冻结 W 不等于跳过基座前向；基座仍参与计算和梯度传播。', 'A 是 r × d_in，B 是 d_out × r；线性层的常见初始化为 A 随机、B 为零，初始 BA 为零。', '输出为 Wx + (alpha/r)B(Ax)。rank 改变参数量；效果不由参数数量单独决定。', '这里仅标出可训练的 A/B，不执行优化。适配器权重少，不代表总训练显存按同一比例降低。', '在合适精度与配置下，可将 (alpha/r)BA 加入 W；这不是无条件的量化无损合并，也不保证端到端零延迟。'] },
  dpo: { title: '一个偏好对，怎样变成训练损失？', note: '固定构造的回答序列 log-prob；不来自模型，不执行训练。参考固定，Δ 只改变两条构造策略概率，beta > 0。', steps: ['偏好对', '参考概率', '策略概率', '校正差值', 'DPO 损失'], explanations: ['同一 prompt 下比较 chosen 与 rejected；偏好标签需有证据和判断条件，不是事实正确性保证。', '固定参考提供比较基线；这里是回答序列 log-prob，不是任意 token 的平均分。', '构造策略 log-prob 与参考作差。此例为便于调节而对称变化，不代表真实梯度更新必然如此。', 'Δ = chosen 的参考校正增益 − rejected 的参考校正增益，关注相对差而非绝对概率排序。', '损失为 softplus(−beta × Δ)。Δ=0 时为 log(2)；固定 Δ 调 beta 只展示代数，不预测训练质量。'] },
  transformer: { title: '跟随一个 token，穿过模型。', note: '单个 decoder block 的教学简化；真实模型会堆叠多个 block，具体归一化顺序依架构而异。', steps: ['Token', 'Embedding', 'Attention', 'FFN', 'Logits'], explanations: ['文本先按 tokenizer 转为 token ID。一个 token 不一定是一个汉字。', '查表得到向量，位置机制让顺序进入后续计算；位置实现因模型不同。', '用 Query 与可见 Key 计算权重，聚合 Value；残差、归一化等路径在图中省略。', '逐位置的前馈变换与非线性进一步处理表示，不直接检索外部知识。', '经后续 block 与输出头得到词表 logits，再按解码策略选择下一 token。'] },
  attention: { title: '选择一个 token，看见它能关注谁。', note: '权重由固定构造 logits 计算 softmax，不来自真实模型；仅展示单头与因果掩码。', steps: ['我们', '用', '证据', '回答', '问题'], explanations: ['第一个位置只可关注自身。', '当前位置可以关注自己与之前的位置。', '开启因果掩码时，未来 token 的权重为零。', '权重更大意味着这个构造例子中的聚合贡献更大，不等于因果解释。', '最后一个位置可以看到前面全部 token，但权重仍由分数决定。'] },
  kv: { title: '从 prefill 到 decode，算清缓存增长。', note: '教学配置：batch=1、32 层、head_dim=128、K/V 各 2 字节；不含分页、量化、工作区与其他状态。', steps: ['Prefill', '+1 token', '+2 tokens', '+3 tokens', '+4 tokens'], explanations: ['prefill 为输入位置生成 K/V；它们可供后续解码复用。', '新位置产生新的 K/V，并追加到缓存。', '历史 K/V 复用，不必再次计算所有历史位置的 K/V。', '缓存随已缓存位置数增长，实际服务还受调度与分配策略影响。', '这里按线性公式算原始载荷，不代表机器可支持的并发数。'] },
  rag: { title: '证据在哪一步，改变了回答？', note: '构造政策案例：问题发生在新版生效后。相关性不等于适用性；图解不调用检索器或模型。', steps: ['问题', '召回', '筛选', '上下文', '回答'], explanations: ['先确定问题日期、对象与权限，才能判断政策是否适用。', '召回结果可能同时包含旧版 500 元与新版 300 元。', '结合有效期筛选证据；不只按语义分数排第一。', '保留新版原文、有效期与来源，不把两个数字平均。', '在当前构造条件下应引用新版 300 元；真实回答仍需验证证据支持。'] },
  agent: { title: '一次工具超时，怎样不重复执行？', note: '构造工单流程；operation_id 在编排器生成，需业务服务支持查询与幂等。不是已执行的业务请求。', steps: ['提议', '校验', '执行', '观察', '恢复'], explanations: ['模型提议创建工单，不自行决定权限。', '执行器检查参数、身份、业务条件与所需审批。', '用稳定 operation_id 执行同一逻辑动作。', '等待响应超时不证明外部动作没有成功。', '按原 operation_id 查询业务记录；已成功则返回原结果，不新建第二张。'] }
}
const lesson = computed(() => content[props.kind])
const attentionWeights = computed(() => {
  const scores = [0.5, 0.9, 2.3, 1.4, 0.6].map((score, index) => score + (index === step.value ? 0.5 : 0))
  const visible = scores.map((score, index) => causal.value && index > step.value ? 0 : Math.exp(score - Math.max(...scores)))
  const total = visible.reduce((sum, value) => sum + value, 0)
  return visible.map(value => value / total)
})
const memoryGiB = computed(() => 2 * 32 * (Number(promptLength.value) + step.value) * Number(kvHeads.value) * 128 * 2 / 2 ** 30)
const explanation = computed(() => {
  if (props.kind === 'attention' && !causal.value) return '关闭掩码后，所有位置参与构造 softmax。它用于对照，不能当作自回归生成时允许看到未来。'
  if (props.kind === 'agent' && !timeout.value && step.value >= 3) return '工具明确返回已成功的工单 ID，记录结果并结束，不再执行同一动作。'
  return lesson.value.explanations[step.value]
})
function pause() { if (timer) clearInterval(timer); timer = undefined; playing.value = false }
function selectStep(index: number) { pause(); step.value = index }
function next() { pause(); step.value = Math.min(step.value + 1, lesson.value.steps.length - 1) }
function togglePlay() {
  if (playing.value) { pause(); return }
  if (reducedMotion.value) return
  if (step.value === lesson.value.steps.length - 1) step.value = 0
  playing.value = true
  timer = setInterval(() => { step.value += 1; if (step.value >= lesson.value.steps.length - 1) pause() }, 1600)
}
function handleVisibility() { if (document.hidden) pause() }
function updateMotion() { reducedMotion.value = Boolean(motionQuery?.matches); if (reducedMotion.value) pause() }
onMounted(() => { motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)'); updateMotion(); motionQuery.addEventListener('change', updateMotion); document.addEventListener('visibilitychange', handleVisibility) })
onBeforeUnmount(() => { pause(); motionQuery?.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', handleVisibility) })
</script>

<template>
  <section class="lesson-lab" :class="'lab-' + kind" :aria-label="lesson.title">
    <div class="lab-heading"><h2>{{ lesson.title }}</h2><span class="lab-badge">交互图解 · 教学示意</span></div>
    <p class="lab-description">{{ lesson.note }}</p>
    <div class="lab-options" v-if="kind === 'attention'"><label><input v-model="causal" type="checkbox" @change="pause" />因果掩码</label><span>选择 Query 位置，查看构造权重。</span></div>
    <div class="lab-options" v-if="kind === 'kv'"><label>输入长度 <input v-model.number="promptLength" type="range" min="512" max="8192" step="512" @input="pause" /><output>{{ promptLength }} token</output></label><label>KV heads <select v-model.number="kvHeads" @change="pause"><option :value="8">8（GQA 示意）</option><option :value="32">32（MHA 示意）</option></select></label></div>
    <div class="lab-options" v-if="kind === 'agent'"><label><input v-model="timeout" type="checkbox" @change="pause" />模拟执行成功、响应超时</label></div>
    <div class="lab-options" v-if="kind === 'rag'"><label><input v-model="outdated" type="checkbox" @change="pause" />候选包含过期政策</label></div>
    <div class="lab-stage-track"><button v-for="(label, index) in lesson.steps" :key="label" type="button" :class="{ active: step === index, passed: index < step }" :aria-pressed="step === index" @click="selectStep(index)"><span>{{ kind === 'attention' ? 'Query ' + (index + 1) : index + 1 }}</span><strong>{{ label }}</strong></button></div>

    <FinetuningDiagram v-if="kind === 'lora' || kind === 'dpo'" :kind="kind" :step="step" @interaction="pause" />
    <div v-if="kind === 'transformer'" class="lab-flow"><div v-for="(label, index) in ['ID', '向量', 'Q · K · V', '非线性', '词表分数']" :key="label" :class="{ illuminated: index <= step }"><span class="flow-port"></span><strong>{{ label }}</strong><span>{{ lesson.steps[index] }}</span></div></div>
    <div v-if="kind === 'attention'" class="attention-display"><div v-for="(token, index) in lesson.steps" :key="token" class="attention-column"><span class="attention-weight">{{ (attentionWeights[index] * 100).toFixed(1) }}%</span><div class="attention-bar-space"><div :style="{ transform: 'scaleY(' + attentionWeights[index] + ')' }" class="attention-bar" :class="{ masked: causal && index > step }"></div></div><strong>{{ token }}</strong><span v-if="causal && index > step">已掩码</span><span v-else>可见</span></div></div>
    <div v-if="kind === 'kv'" class="kv-display"><div class="cache-blocks"><div class="cache-original"><span>输入 K/V</span><strong>{{ promptLength }} 位置</strong></div><div v-for="index in 4" :key="index" class="cache-token" :class="{ cached: index <= step }"><span>+{{ index }}</span><strong>K / V</strong></div></div><div class="cache-ledger"><span>原始 KV 载荷</span><strong>{{ memoryGiB.toFixed(4) }} <small>GiB</small></strong><span>{{ Number(promptLength) + step }} 个位置 · {{ kvHeads }} KV heads</span></div></div>
    <div v-if="kind === 'rag'" class="rag-display"><div v-if="outdated && step > 0" class="evidence-doc" :class="{ rejected: step >= 2 }"><span>旧版 · 已失效</span><strong>500 元</strong><small>{{ step >= 2 ? '不进入适用上下文' : '相关，但不适用' }}</small></div><div v-if="step > 0" class="evidence-doc" :class="{ accepted: step >= 2 }"><span>新版 · 当前适用</span><strong>300 元</strong><small>保留来源与有效期</small></div><div class="rag-answer"><span>{{ step === 4 ? '当前构造案例的回答' : '证据检查' }}</span><strong>{{ step === 4 ? '依据新版政策：300 元' : step < 2 ? '先检索，不急着回答' : '相关性 ≠ 适用性' }}</strong></div></div>
    <div v-if="kind === 'agent'" class="agent-display"><div class="operation-log"><span>operation_id</span><code>task-17-step-3</code><p>{{ step < 2 ? '逻辑动作已绑定，尚未执行' : '业务端记录：工单 draft-8 已创建' }}</p></div><div class="operation-result" :class="{ warning: timeout && step === 3, resolved: step === 4 }"><AtlasIcon :name="step === 4 ? 'check' : 'network'" :size="28" /><strong>{{ step < 3 ? '等待执行与观察' : step === 3 && timeout ? '响应超时 · 结果未知' : '结果确认 · 不重复创建' }}</strong><span>{{ step === 4 && timeout ? '按原操作 ID 查询，返回已有结果' : '执行器负责确认业务事实' }}</span></div></div>
    <p class="lab-explanation" aria-live="polite">{{ explanation }}</p>
    <div class="lab-controls"><div><button type="button" @click="togglePlay" :disabled="reducedMotion" :aria-label="playing ? '暂停图解' : '播放图解'"><AtlasIcon :name="playing ? 'pause' : 'play'" :size="16" />{{ playing ? '暂停' : '播放' }}</button><button type="button" @click="next" :disabled="step === lesson.steps.length - 1">下一步<AtlasIcon :size="16" /></button><button type="button" @click="selectStep(0)"><AtlasIcon name="reset" :size="16" />复位</button></div><span>{{ reducedMotion ? '减少动画已开启 · 请手动选择步骤' : '默认暂停 · 可选择任意步骤' }}</span></div>
  </section>
  <LessonSelfCheck :kind="kind" @interaction="pause" />
</template>
