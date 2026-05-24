# Attention 与变体

> 注意力机制是 Transformer 的灵魂，也是面试最爱深挖的考点。本文从 Self-Attention 的数学与直觉讲起，到多头注意力的维度走查、因果掩码、KV Cache，再到 MHA→MQA→GQA→MLA 的演进与稀疏/线性注意力，力求把「为什么」讲透。架构全景见 [Transformer](/basics/transformer)，FlashAttention 见 [深入页](/advanced/flash-attention)。

## 一、自注意力机制（Self-Attention）

### 1.1 直觉

处理一句话时，每个词的含义都依赖上下文。例如「苹果」在「我吃苹果」和「苹果发布会」中含义不同。自注意力让每个 token 根据「与其他词的相关程度」，从所有 token 那里**加权聚合信息**，从而获得带上下文的表示。

### 1.2 QKV 与计算步骤

每个 token 的输入向量分别乘以三个可学习权重矩阵，得到 **Query（查询）、Key（键）、Value（值）**：

$$Q = XW_Q,\quad K = XW_K,\quad V = XW_V$$

然后：

$$\text{Attention}(Q,K,V)=\text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

逐步拆解（设序列长 n、维度 d_k）：

1. **算分数** `QKᵀ`：每个 token 的 Q 与所有 token 的 K 做点积 → n×n 的注意力分数矩阵，第 (i,j) 项表示「token i 对 token j 的关注度」。
2. **缩放** `/√d_k`：见下。
3. **softmax**：对每一行归一化成权重（每行和为 1）。
4. **加权求和** `×V`：用权重对所有 token 的 V 加权求和，得到每个 token 的输出。

**QKV 类比**：图书检索——Q 是你的检索词，K 是每本书的标签，Q·K 衡量匹配度，V 是书的实际内容，最终按匹配度把内容加权取回。

### 1.3 三个高频「为什么」

**为什么除以 √d_k（缩放）？** Q·K 是 d_k 个数的点积，当 d_k 大时点积方差约为 d_k、绝对值变大，使 softmax 进入梯度极小的饱和区（输出接近 one-hot），梯度消失、训练不稳。除以 √d_k 把方差拉回 1 量级，保持 softmax 处于敏感区间。

**为什么要 Q、K、V 三个不同矩阵？** 解耦三种角色——「用什么去查（Q）、拿什么被查（K）、查到取什么（V）」，可分别学习、表达力更强。若直接用输入向量两两点积，会强制对称且表达受限。

**Attention 复杂度为什么是 O(n²)？** 要算每对 token 的分数，n 个 token 两两组合即 n² 量级（再乘维度 d 是 O(n²d)）。这是长序列昂贵的根源，催生了稀疏注意力、FlashAttention、长上下文优化等。

## 二、多头注意力（Multi-Head Attention, MHA）

不止做一次注意力，而是把 Q/K/V 投影到 **h 个低维子空间**并行做注意力，再拼接、过一次输出投影：

$$\text{MultiHead}=\text{Concat}(\text{head}_1,...,\text{head}_h)W^O,\quad \text{head}_i=\text{Attention}(QW_i^Q,KW_i^K,VW_i^V)$$

**维度走查**（d_model=512, h=8, 序列长 n）：

```
输入 (n, 512)
  │ 投影到 8 个头，每头 d_head = 512/8 = 64
  ▼
8 × [Q,K,V each (n, 64)] ── 各自做 Attention ──▶ 8 × (n, 64)
  │ Concat
  ▼
(n, 512) ── × W^O (512×512) ──▶ (n, 512)
```

由于每头维度 d_head = d_model/h，h 个头的总计算量与单头（d_model 维）相近。

**为什么要多头？** 让模型在不同子空间关注不同模式——有的头看局部语法、有的头看长程指代、有的头看实体共现。类似 CNN 的多个卷积核各司其职。**头数不是越多越好**：头太多则每头维度太小、表达受限，是需权衡的超参。

## 三、掩码（Mask）

- **因果掩码（Causal/Masked）**：Decoder 生成第 t 个 token 时不能看未来。把注意力分数矩阵的**上三角置为 −∞**，softmax 后变 0。这是自回归生成的关键。
- **Padding 掩码**：batch 内序列长度不齐，对填充的 `<pad>` 位置做掩码，避免它们污染注意力。

## 四、KV Cache：长上下文的瓶颈之源

自回归生成时，每生成一个新 token 都要重新计算所有历史 token 的 K、V，非常浪费。**KV Cache** 把历史 token 的 K、V 缓存下来，每步只算新 token 的 Q 与历史 K/V 的注意力，大幅加速推理。

代价：**KV Cache 显存随「序列长度 × 层数 × 头数 × 头维度 × batch」线性增长**，成为长上下文/高并发推理的主要瓶颈。这直接催生了下面对「头」做共享/压缩的一系列变体。详见 [推理优化](/inference/inference-optimization)、[长上下文](/basics/long-context)。

## 五、MHA → MQA → GQA → MLA：省 KV 的演进

| 方案 | K/V 头数 | KV Cache | 质量 | 代表模型 |
| --- | --- | --- | --- | --- |
| **MHA**（多头） | 每个 Q 头各有独立 K/V | 最大 | 最好 | 原始 Transformer、GPT-2 |
| **MQA**（多查询） | 所有 Q 头**共享 1 组** K/V | 最小 | 略降 | PaLM、Falcon |
| **GQA**（分组查询） | Q 头**分组**，组内共享 K/V | 折中 | 接近 MHA | LLaMA 2/3、Qwen |
| **MLA**（多头潜在） | 把 KV **低秩压缩**成潜向量再缓存 | 很小 | 近乎无损 | DeepSeek 系列 |

- **MQA**：所有查询头共享同一组 K/V，KV Cache 缩小 h 倍，但质量有损。
- **GQA**：折中——把 Q 头分成 g 组，每组共享一组 K/V（g=1 即 MQA，g=h 即 MHA）。**几乎不掉点的同时显著降 KV Cache，是当前主流**。
- **MLA**：DeepSeek 提出，把 K、V **联合低秩压缩**成一个小的潜在向量，缓存这个潜向量、用时上投影还原。比 GQA 省得更多且质量更好，详见 [DeepSeek 专题](/models/deepseek)。

**为什么只共享/压缩 K/V，不动 Q？** 推理瓶颈在 KV Cache 的显存与带宽；Q 不需要缓存，共享 Q 无收益且损害表达力。

## 六、FlashAttention：让注意力又快又省

**FlashAttention 是 IO 感知的精确注意力算法**（结果与标准注意力完全一致，非近似）。核心：分块（tiling）+ online softmax + 算子融合，把中间的 N×N 矩阵留在 GPU 高速 SRAM 中分块计算，避免反复读写慢速 HBM。收益：显存 O(n²)→O(n)、速度数倍提升。原理与 v1/v2/v3 演进详见 [FlashAttention 深入](/advanced/flash-attention)。

## 七、高效注意力变体（降 O(n²)）

长序列下还有一类「改注意力本身」的方案，详见 [长上下文](/basics/long-context)：

- **滑动窗口注意力**：每个 token 只关注最近 W 个（Mistral），多层叠加扩大有效感受野。
- **稀疏注意力**：只算部分注意力对（局部 + 少量全局），如 Longformer、BigBird。
- **线性注意力 / SSM**：用 O(n) 机制替代 softmax 注意力，如 [Mamba](/advanced/state-space-models)。
- **StreamingLLM / Attention Sink**：保留开头几个「汇聚点」token 的 KV + 最近窗口，稳定处理超长流式输入。

## 八、交叉注意力（Cross-Attention）

在 Encoder-Decoder 结构中，Decoder 用**自己的 Q** 去查询 **Encoder 输出的 K、V**，从而「关注」输入序列（如翻译时对齐源语言）。纯 Decoder-only 模型没有交叉注意力。多模态里也用交叉注意力把视觉特征注入语言模型（见 [多模态](/multimodal/multimodal)）。

## 九、高频追问

**Q：Self-Attention 的公式与每一步含义？** `softmax(QKᵀ/√d_k)V`：QKᵀ 算两两相关性 → 缩放 → softmax 归一化成权重 → 对 V 加权求和。

**Q：为什么除以 √d_k？** 防止点积方差随维度增大而变大、使 softmax 饱和导致梯度消失。把方差归一到 1 量级，稳定训练。

**Q：为什么要 Q、K、V 三个矩阵？** 解耦「查询/被查/取值」三种角色分别学习，表达力更强；直接点积会对称且受限。

**Q：MHA、MQA、GQA、MLA 的区别？** MHA 每个 Q 头有独立 KV（显存大、质量好）；MQA 所有 Q 头共享 1 组 KV（最省、略降质量）；GQA 分组共享（折中、主流）；MLA 低秩压缩 KV（DeepSeek，省得多且近乎无损）。

**Q：为什么 MQA/GQA 只共享 K/V？** 推理瓶颈是 KV Cache 显存与带宽，Q 不缓存；共享 Q 无收益且损害表达力。

**Q：KV Cache 是什么？为什么是长上下文瓶颈？** 缓存历史 token 的 K、V 避免重算，加速自回归生成；但显存随序列长度线性增长，长上下文/高并发下成为主要瓶颈。对策：GQA/MQA/MLA、KV 量化、PagedAttention。

**Q：多头注意力头数越多越好吗？** 不是。固定 d_model 下头越多每头维度越小、单头表达越弱；需权衡。常见做法是 d_head 取 64/128。

**Q：FlashAttention 是近似吗？为什么快？** 不是近似，结果与标准注意力完全一致。它靠分块 + online softmax 把中间矩阵留在 SRAM、减少对慢速 HBM 的读写（注意力是访存受限的），所以快且省显存。

**Q：Attention 为什么是 O(n²)？怎么缓解？** 需算每对 token 的分数。缓解：FlashAttention（降访存）、稀疏/滑窗注意力、线性注意力/SSM、长上下文扩展。

**Q：自注意力和交叉注意力的区别？** 自注意力的 Q、K、V 来自同一序列；交叉注意力的 Q 来自一个序列（如 Decoder）、K/V 来自另一个序列（如 Encoder 输出），用于跨序列对齐。

**Q：因果掩码怎么实现？** 把注意力分数矩阵的上三角（未来位置）置为 −∞，softmax 后这些位置权重为 0，从而每个 token 只能注意到自己及之前的位置。
