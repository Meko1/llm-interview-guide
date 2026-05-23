# Transformer 架构详解

> Transformer 是几乎所有大模型的基石，也是面试出现频率最高的考点。本文从整体结构讲到每个组件的作用与高频追问。

## Transformer 是什么？为什么它能取代 RNN？

Transformer 出自 2017 年论文《Attention Is All You Need》，是一种完全基于注意力机制（Attention）、抛弃了循环（RNN）和卷积（CNN）结构的序列建模架构。

相比 RNN/LSTM，它的优势在于：

- **并行化训练**：RNN 必须按时间步串行计算，Transformer 对整个序列同时计算 Attention，能充分利用 GPU 并行能力，训练速度大幅提升。
- **长距离依赖建模**：RNN 的信息要逐步传递，距离越远越容易梯度消失/遗忘；Transformer 中任意两个位置之间的路径长度都是 O(1)，能直接建立长距离关联。
- **可扩展性强**：结构规整、易于堆叠，配合缩放定律可以稳定地放大到千亿参数。

代价是自注意力的复杂度是序列长度的平方 O(n²)，长序列开销大（这也催生了 FlashAttention、稀疏注意力等优化）。

## 整体结构

原始 Transformer 是 **Encoder-Decoder** 架构：

- **Encoder**：由 N 个相同的层堆叠，每层包含「多头自注意力 + 前馈网络（FFN）」两个子层，每个子层都有残差连接和 LayerNorm。
- **Decoder**：每层多了一个「交叉注意力（Cross-Attention）」子层，用来关注 Encoder 的输出；自注意力部分使用「掩码（Masked）」以保证自回归性（生成第 t 个 token 时只能看到前面的 token）。

按结构，现代大模型分为三类：

| 类型 | 代表 | 特点 | 适合任务 |
| --- | --- | --- | --- |
| Encoder-only | BERT | 双向注意力，擅长理解 | 分类、NER、检索 |
| Decoder-only | GPT、LLaMA | 单向（因果）注意力，擅长生成 | 文本生成、对话 |
| Encoder-Decoder | T5、BART | 编码理解 + 解码生成 | 翻译、摘要 |

> **为什么主流 LLM 都是 Decoder-only？** 训练目标统一为下一个 token 预测，简单且能充分利用所有数据；自回归生成天然适配对话；规模扩展时表现更稳定；且在 in-context learning 上效果好。

## 核心组件

### 1. 输入表示：Embedding + 位置编码

Token 先经过词嵌入（Token Embedding）变成向量，再叠加位置编码（Positional Encoding），因为 Attention 本身对顺序无感知（置换不变），必须显式注入位置信息。详见[位置编码](/basics/position-encoding)。

### 2. 自注意力（Self-Attention）

通过 Query、Key、Value 三个矩阵，计算每个 token 对其他 token 的关注权重并加权求和。这是 Transformer 的灵魂，详见 [Attention 与变体](/basics/attention)。

### 3. 多头注意力（Multi-Head Attention）

把 Q/K/V 投影到多个子空间并行做注意力，再拼接。让模型能在不同子空间关注不同模式（如语法、指代、语义），类似 CNN 的多个卷积核。

### 4. 前馈网络（FFN / MLP）

每个位置独立地通过两层全连接（中间通常放大 4 倍维度）并加激活函数。它提供了模型的非线性表达能力，也是参数量的主要来源之一。现代模型常用 **SwiGLU** 替代 ReLU/GELU。

### 5. 残差连接（Residual）与归一化（LayerNorm）

- **残差连接**：`x + Sublayer(x)`，缓解深层网络梯度消失，让信息能跨层流动。
- **LayerNorm**：稳定训练。现代大模型多用 **RMSNorm**（更省算力）并采用 **Pre-Norm**（归一化放在子层之前），训练更稳定。

## 高频追问

**Q：Self-Attention 的计算公式？**

$$\text{Attention}(Q,K,V)=\text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

**Q：为什么要除以 √dₖ（缩放）？** 当维度 dₖ 较大时，点积结果方差会变大，使 softmax 进入梯度极小的饱和区，导致训练不稳定。除以 √dₖ 把方差拉回 1 量级。

**Q：Pre-Norm 和 Post-Norm 的区别？** 原始论文是 Post-Norm（LayerNorm 在残差之后），深层时不易训练；Pre-Norm（LayerNorm 在子层之前）梯度更稳定、可以训得更深，是现代主流，代价是表达能力略有损失。

**Q：FFN 中间为什么放大 4 倍？** 经验性设计，提供足够的非线性容量；这是超参数，并非必须为 4。

**Q：参数量怎么估算？** 对 Decoder-only 模型，主要来自每层的 Attention（约 4·d²）和 FFN（约 8·d²），单层约 12·d²，乘以层数 L 再加上 Embedding，即可粗估总参数量。
