# Attention 与变体

> 注意力机制是 Transformer 的核心。本文讲清 Self-Attention 的原理，以及面试常考的 MHA / MQA / GQA / FlashAttention 等变体。

## 自注意力机制原理

直觉：处理一句话时，每个词的含义都依赖上下文。Attention 让每个 token 根据「相关程度」从其他所有 token 那里聚合信息。

具体步骤：

1. 每个 token 的输入向量分别乘以三个权重矩阵，得到 **Query（查询）**、**Key（键）**、**Value（值）**。
2. 用当前 token 的 Q 与所有 token 的 K 做点积，得到注意力分数（相关性）。
3. 除以 √dₖ 缩放后做 softmax，得到归一化的注意力权重。
4. 用权重对所有 token 的 V 加权求和，得到该 token 的输出。

$$\text{Attention}(Q,K,V)=\text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

**QKV 的类比**：在「图书检索」中，Q 是你的检索词，K 是每本书的标签，Q·K 衡量匹配度，V 是书的实际内容，最终按匹配度把内容加权取回。

## 多头注意力（Multi-Head Attention, MHA）

将 Q/K/V 投影到 h 个低维子空间，分别做注意力后拼接再线性变换。好处是模型可以在不同「头」里关注不同类型的关系（如局部语法、长程指代）。每个头维度通常为 `d_model / h`，因此总计算量与单头相近。

## 因果掩码（Causal Mask）

在 Decoder 中，生成第 t 个 token 时不能看到未来的 token。通过把注意力分数矩阵的上三角部分置为 -∞（softmax 后变 0）实现，称为 **Causal / Masked Attention**。这是自回归生成的关键。

## KV Cache 与高效注意力变体

自回归生成时，每生成一个新 token 都要重新计算所有历史 token 的 K、V，非常浪费。**KV Cache** 把历史 token 的 K、V 缓存下来，每步只算新 token，大幅加速推理——但显存占用随序列长度线性增长，成为长上下文推理的瓶颈。

为缓解 KV Cache 显存压力，出现了对「头」的共享方案：

| 方案 | K/V 头数 | 显存 | 质量 | 代表模型 |
| --- | --- | --- | --- | --- |
| MHA（多头） | 每个 Q 头各有 K/V | 最大 | 最好 | 原始 Transformer、GPT-2 |
| MQA（多查询） | 所有 Q 头共享 1 组 K/V | 最小 | 略降 | PaLM、Falcon |
| GQA（分组查询） | Q 头分组，组内共享 K/V | 折中 | 接近 MHA | LLaMA 2/3、Qwen |

> **GQA 是当前主流折中方案**：在 MHA 的质量和 MQA 的省显存之间取平衡，几乎不掉点的同时显著降低 KV Cache。

**MLA（Multi-head Latent Attention）**：DeepSeek 提出，通过对 KV 做低秩压缩进一步降低 KV Cache，同时保持性能，是更激进的优化方向。

## FlashAttention

FlashAttention 是一种 **IO 感知的精确注意力算法**（结果与标准注意力完全一致，非近似）。核心思想是利用分块（tiling）和算子融合，把中间的大 N×N 注意力矩阵留在 GPU 高速的 SRAM 中分块计算，避免反复读写慢速的 HBM 显存。

收益：**显存从 O(n²) 降到 O(n)**，速度数倍提升，且支持更长上下文。FlashAttention-2/3 进一步优化了并行与硬件利用率，是现代训练/推理的标配。

## 高频追问

**Q：为什么需要 Q、K、V 三个不同矩阵，而不是直接用输入做点积？** 让模型有更强的表达力——「用什么去查」（Q）、「拿什么被查」（K）、「查到后取什么」（V）解耦，可分别学习。

**Q：Attention 复杂度为什么是 O(n²)？** 需要计算每对 token 之间的分数，n 个 token 两两组合即 n² 量级，长序列开销大。稀疏注意力、滑动窗口注意力（如 Mistral）等用于降低此开销。

**Q：MQA/GQA 为什么只共享 K/V 不共享 Q？** 推理瓶颈在 KV Cache 的显存与带宽；Q 不需要缓存，共享 Q 无收益且会损害表达能力。
