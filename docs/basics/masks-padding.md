# Mask 与 Padding：因果掩码、填充与序列打包

> 「因果掩码和 padding 掩码有什么区别？」「decoder-only 推理为什么要左 padding？」「训练时 packing 是什么、会不会串味？」——这些是简历上写过微调/推理的人必被追问的实现级细节，也是手撕 Attention 时最容易写错的部分。本文把**两种 mask 的本质、padding 方向、序列打包（packing）、以及它们与 KV Cache/损失计算的联动**讲透。Attention 原理见 [Attention 与变体](/basics/attention)，损失屏蔽见 [从 Logits 到损失](/basics/logits-loss)，KV Cache 见 [KV Cache 原理](/inference/kv-cache)。

## 面试先背这几句话

- **因果掩码（causal mask）管「时间」**：不许看未来，是 decoder-only 模型的本质属性，训练推理都在；**padding 掩码管「有效性」**：不许看填充位，只因 batch 内长度不齐而存在。
- 两种 mask 在实现上殊途同归：把不该看的位置的注意力分数**加 −∞**（softmax 后变 0），再相加合并。
- **训练/批量 prefill 用右 padding，decoder-only 生成用左 padding**：生成时新 token 必须紧挨着真实内容，右边留 padding 会让「最后一个位置」是垃圾。
- **Packing（序列打包）**：把多条短样本拼进一个长序列消灭 padding 浪费，配合**块对角注意力掩码**（或 FlashAttention 的 varlen 接口）防止样本互相「串味」。
- padding 位置除了 attention 要屏蔽，**损失也要屏蔽**（ignore_index=-100），两处漏一处都是 bug。

## 一、为什么需要 Mask

Attention 的原始形式是「每个位置看所有位置」：$\text{softmax}(QK^T/\sqrt{d})V$。但有两类「不该看」：

1. **未来不可看**（因果性）：语言模型训练目标是预测下一个 token，如果位置 t 能看到 t+1，就是**标签泄漏**，训练直接作弊。
2. **填充不可看**（有效性）：batch 内序列长短不一，短的要补 padding token 对齐成矩形张量；padding 是无意义占位，被注意到会污染表示。

实现手法统一：构造 mask 矩阵，把非法位置的注意力分数置为 $-\infty$（实际用 −1e9 或 dtype 最小值），softmax 后这些位置权重为 0。

```python
scores = Q @ K.T / sqrt(d)          # [seq, seq]
scores = scores.masked_fill(mask == 0, float('-inf'))
attn   = softmax(scores, dim=-1)
```

## 二、因果掩码（Causal Mask）★

### 2.1 形状与含义

下三角矩阵：位置 $i$ 只能注意 $j \le i$：

```
      k0  k1  k2  k3
q0 [   ✓   ✗   ✗   ✗ ]
q1 [   ✓   ✓   ✗   ✗ ]
q2 [   ✓   ✓   ✓   ✗ ]
q3 [   ✓   ✓   ✓   ✓ ]
```

- 它使**一次前向就能并行训练所有位置**：每个位置在「只看得见前文」的约束下同时预测下一个 token（teacher forcing），这是 Transformer 取代 RNN 的效率来源之一（见 [Transformer 架构详解](/basics/transformer)）。
- **推理时同样存在**：prefill 阶段对整个 prompt 用因果掩码；decode 阶段新 token 天然只能看到已生成的 KV（KV Cache 里只有过去），因果性由结构保证。

### 2.2 与 encoder/双向模型的对比

BERT 类 encoder 用**双向注意力**（无因果掩码），适合理解任务；decoder-only 用因果掩码做生成。Prefix-LM 折中：前缀部分双向、生成部分因果。面试常以「BERT 和 GPT 的注意力有什么区别」形式出现，答案核心就是**有无因果掩码**。

## 三、Padding 掩码 ★

### 3.1 为什么有 padding

GPU 要求 batch 是规整张量，batch 内句子长度不一，就用特殊 pad token 补齐到同长。pad 位置需要：

1. **attention 屏蔽**：任何位置都不应注意到 pad（列屏蔽）。
2. **损失屏蔽**：pad 位置不计损失（`ignore_index=-100`，见 [从 Logits 到损失](/basics/logits-loss)）。
3. HuggingFace 里对应 `attention_mask`（1=有效，0=padding），与因果掩码**按位与**合并。

### 3.2 左 padding vs 右 padding ★（高频坑）

| | 右 padding（尾部补） | 左 padding（头部补） |
| --- | --- | --- |
| 形态 | `[A B C pad pad]` | `[pad pad A B C]` |
| 训练/批量前向 | ✅ 标准做法 | 少用 |
| **decoder-only 批量生成** | ❌ **错误**：生成从「最后一个位置」续写，右侧是 pad，模型对着垃圾续写 | ✅ **正确**：真实内容顶到右端，新 token 紧接真实上文 |

这就是 HuggingFace 对 decoder-only 模型做 `generate` 时要求 `tokenizer.padding_side = "left"` 的原因——面试问「为什么推理要左 padding」，标准答案：**自回归生成永远从序列最右端继续，必须保证最右端是真实内容而非 padding**。

（配合位置编码时，pad 位置的 position id 也要正确偏移，否则 RoPE 相位错位——工程实现里 `position_ids` 由 attention_mask 累加得出。）

### 3.3 现代推理框架为什么「没有 padding」

vLLM/SGLang 等框架不做 batch padding：它们把请求的 token **摊平成连续序列 + 记录每条的边界**（varlen/ragged batching），配合 PagedAttention 按块管理 KV。padding 本质是为了「矩形张量」而浪费算力，摊平方案从根上消灭浪费（见 [推理框架对比](/inference/serving-frameworks)）。

## 四、序列打包（Packing）★

### 4.1 动机

预训练/SFT 语料长短悬殊：按最长补齐，短样本 batch 里可能 **50%+ 算力花在 pad 上**。Packing 把多条样本首尾相接拼成固定长度（如 4096）的序列，几乎零浪费。

```
序列1: [样本A(1200) | 样本B(800) | 样本C(2000) | pad(96)]
```

### 4.2 关键问题：样本间「串味」（cross-contamination）

朴素拼接后，因果掩码只挡「未来」，不挡「别的样本」——样本 C 的 token 能注意到 A、B 的内容，造成无关上下文污染。解法：

- **块对角因果掩码（block-diagonal causal mask）**：在因果掩码基础上再限制「只看本样本范围内的前文」，每个样本一个独立三角块。
- **重置 position ids**：每个样本内位置从 0 重新计数，RoPE 相位不跨样本。
- **实现**：FlashAttention 提供 `varlen` 接口（传 `cu_seqlens` 边界数组），不需物化巨大 mask 矩阵；主流微调框架（LLaMA-Factory、Axolotl 等）都有 packing 开关（见 [微调训练工具链实战](/finetuning/training-frameworks)）。

> 追问「不隔离行不行？」——早期不少预训练就是朴素拼接（用 EOS 分隔），实践上模型也能学会「EOS 后重置注意」，但 SFT 等短样本场景中隔离更干净、已成为标准做法。面试答「要隔离 + 说得出 block-diagonal 与 position id 重置」即到位。

### 4.3 其他相关变体

- **动态 batching / 长度分桶（bucketing）**：把相近长度的样本分到同一 batch，减小 padding，比 packing 简单。
- **SFT 的 prompt 屏蔽**：packing 后每条样本内还要继续屏蔽 prompt 部分的损失，mask 逻辑三层叠加（因果 + 样本边界 + 损失屏蔽），实现时最容易错。

## 五、Mask 全家福（面试速查）

| Mask | 屏蔽什么 | 何时存在 | 实现 |
| --- | --- | --- | --- |
| 因果掩码 | 未来位置 | decoder-only 恒有 | 下三角，score 加 −∞ |
| Padding 掩码 | 填充位置 | batch 长度不齐时 | attention_mask 列屏蔽 |
| 块对角掩码 | 其他样本 | packing 训练 | varlen/cu_seqlens |
| 损失掩码 | pad + prompt 部分 | 训练算 loss | labels=-100 |
| 滑动窗口掩码 | 距离>W 的位置 | Mistral 等 SWA 模型 | 带状三角（见 [长上下文专题](/basics/long-context)） |
| 前缀双向掩码 | 生成段的未来 | Prefix-LM / 多模态前缀 | 前缀内全通，生成段因果 |

## 高频追问

1. **因果掩码和 padding 掩码的区别？** 因果管时间（不看未来，模型本质属性，训练推理恒有）；padding 管有效性（不看填充，仅因 batch 对齐存在）；实现都是 score 加 −∞，可按位与合并。
2. **为什么 decoder-only 批量生成要左 padding？** 生成从最右位置续写，右 padding 会让模型对着 pad 续写；左 padding 保证最右端是真实上文，同时 position_ids 要按 attention_mask 修正。
3. **训练时哪些位置不算损失？** padding 位置和（SFT 场景）prompt 部分，用 ignore_index=-100；attention 屏蔽与损失屏蔽是两处独立的事，都不能漏。
4. **Packing 是什么？怎么防串味？** 多条短样本拼一条长序列消灭 padding；用块对角因果掩码限制只看本样本 + 每样本重置 position ids；FlashAttention varlen 接口免物化 mask。
5. **为什么 vLLM 里没有 padding？** 用 varlen/ragged 方式摊平所有请求 token 并记录边界，配合 PagedAttention 管 KV，从根上消灭矩形补齐的浪费。
6. **BERT 和 GPT 注意力的区别？** BERT 双向（无因果掩码，适合理解），GPT 因果单向（生成）；Prefix-LM 前缀双向+生成因果折中。
7. **手撕 Attention 时 mask 怎么写？** 分数矩阵上 `masked_fill(mask==0, -inf)` 再 softmax；注意 −∞ 要用 dtype 安全值，且 mask 要广播到 [batch, head, q, k]。
8. **推理的 decode 阶段还需要因果掩码吗？** 结构上天然满足：KV Cache 里只有历史 token，新 token 只能看到过去，无需显式未来屏蔽；prefill 阶段仍需完整因果掩码。
