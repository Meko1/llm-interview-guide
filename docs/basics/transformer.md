---
title: Transformer 架构详解
description: 从 token 数据流、组件职责与张量形状理解 Transformer，结合参数算例、失败案例和分层追问。
level: L1
roles:
  - 在校生
  - 算法研究
  - 应用开发
classification: reviewed
---
# Transformer 架构详解

> 本页负责串起 Transformer 的数据流、组件职责与资源取舍。主阅读级别为 L1；工程决策与研究追问面向 L2/L3。前置要求是矩阵乘法与基本概率，第一次阅读可先跳过长推导。

<LessonLab kind="transformer" />

## 阅读目标：从组件名走向数据流

| 阅读深度 | 要回答的问题 | 检验方式 |
| --- | --- | --- |
| L0 / L1 | 一个 token 经历哪些变换？ | 画出 Embedding → Attention → FFN → logits，不把 logits 当概率 |
| L2 | 序列长度、隐藏维度和并发分别影响什么？ | 分开算参数、注意力中间量与 KV Cache，不只报一个大 O |
| L3 | 为什么选某种归一化、位置编码与注意力结构？ | 提出对照实验，区分结构收益和训练配方差异 |

## 工程走查：同一层里有两类不同的成本

以 **MHA、两层线性 FFN、忽略 bias 和归一化小项** 的教学层为例，设 batch 为 $B$、序列长度为 $T$、隐藏维度为 $d$、FFN 中间维度为 $d_{ff}$：

- 输入与输出均为 $[B,T,d]$。Attention 改变 token 之间的信息交互，FFN 逐 token 变换特征，不改变 token 数量。
- 参数约为 $4d^2 + 2dd_{ff}$；取 $d_{ff}=4d$ 才得到常见的 $12d^2$。GQA、门控 FFN、权重共享与 MoE 都要重新按实际矩阵计数，不能套用此式。
- 投影与 FFN 的主要矩阵乘成本随 $BTd^2$ 增长；密集注意力的两次矩阵乘随 $BT^2d$ 增长。固定 $d$ 时，序列加倍使注意力核心算术量约四倍，但不代表完整端到端耗时四倍。
- 训练的激活、推理的权重与 KV Cache 属于不同账本；参数量相同的两个模型也可能有不同的并发上限。

**算例**：$d=512,d_{ff}=2048$ 时，单层近似参数为 $4\times512^2+2\times512\times2048=3{,}145{,}728$，不含 Embedding 和输出头。先确认结构假设，再把层数乘上去。

## 失败案例：训练看似正常，生成却不正常

| 现象 | 应排查的边界 | 不应直接下的结论 |
| --- | --- | --- |
| 训练 loss 很低，部署生成很差 | target shift、因果 mask、数据泄漏与训练 / 推理模板差异 | 「模型规模不够」 |
| 开启 KV Cache 后输出变化明显 | 位置索引、缓存长度、padding 与 mask 对齐 | 「缓存天然是有损近似」 |
| 长输入 OOM | 激活、中间矩阵、KV 与运行时工作区分别计数 | 「参数不多就不会 OOM」 |
| FP16 出现 NaN | mask 全屏蔽行、score 溢出、归约精度 | 「调小学习率一定能解决」 |

<details>
<summary>L3 追问：不加位置编码，Attention 是不变还是等变？</summary>

无位置编码、无固定因果等位置相关 mask 时，对 token 维应用同一置换矩阵 $P$，有 $Q'=PQ,K'=PK,V'=PV$。分数变为 $P(QK^\top)P^\top$，逐行 softmax 与置换相容，输出满足 $f(PX)=Pf(X)$。这是**置换等变**，不是输出保持不变。固定因果 mask 会引入顺序约束，不满足上述无条件推导。把 token 输出进一步用对称池化聚合，才可能获得置换不变的整体表示。

面试追加实验：保持权重不变，打乱 token；分别比较无 mask 与因果 mask 的输出，解释为什么测试前必须声明假设。
</details>

## 一手参考与使用边界

- [Attention Is All You Need（2017）](https://arxiv.org/abs/1706.03762)：原始 Encoder–Decoder、缩放点积与参数设计；不等同于所有现代 Decoder-only 结构。
- [On Layer Normalization in the Transformer Architecture（2020）](https://arxiv.org/abs/2002.04745)：Pre-LN / Post-LN 的梯度与 warmup 分析；不能简化为一方永远表达力更强。
- [GQA（2023）](https://arxiv.org/abs/2305.13245)：查询头与 KV 共享的设计；具体质量与效率取决于训练和任务。
- [UL2（2022）](https://arxiv.org/abs/2205.05131)：区分架构与预训练目标；上下文学习并非 Decoder-only 的独占能力。
- [PyTorch SDPA 官方实现说明](https://github.com/pytorch/pytorch/blob/main/torch/nn/functional.py)：布尔 mask、dropout 与不同内核的数值边界。`main` 是移动分支，复现时应固定所用版本。
- [Transformers 因果语言模型损失实现](https://github.com/huggingface/transformers/blob/main/src/transformers/loss/loss_utils.py)：核查标签移位、忽略位置与归约方式，不能把框架的自动 shift 再做一次。
- [FlashAttention（2022）](https://arxiv.org/abs/2205.14135)：通过 IO 感知实现精确注意力；降低访存不等于消除密集注意力的平方算术量。

本轮实际读取上述论文摘要及 SDPA、`ForCausalLMLoss` 对应实现段；公式算例为教学推导，不是训练或性能复现实验。

下面保留完整机制讲解。首次阅读先走数据流，再按问题进入子专题。

![Transformer Decoder-Only 块结构：残差直通 + Pre-Norm](/diagrams/transformer.svg)

## 一、为什么会有 Transformer？

### 1.1 RNN/LSTM 时代的瓶颈

在 Transformer（2017）之前，序列建模主流是 RNN/LSTM/GRU。它们按时间步**串行**处理序列：第 t 步的输出依赖第 t−1 步的隐藏状态。这带来三个根本问题：

- **时间维依赖**：标准递归状态必须逐步计算；batch、矩阵运算仍能并行，不能说 RNN 完全无法利用 GPU。
- **长路径优化困难**：远距离信息和梯度要经过许多状态更新。LSTM 的门控缓解了这一问题，但不能保证任意长度上的有效记忆。
- **固定向量瓶颈**：早期无注意力的 seq2seq 将源序列压进固定向量，长输入的细节更难保留；这不是所有 RNN 架构的必然限制。

2014–2015 年，**Attention 机制**被引入 seq2seq，让解码器在每一步能「回看」编码器的所有隐藏状态、按需加权——大幅缓解了信息瓶颈。但模型主干仍是 RNN，串行问题还在。

### 1.2 Transformer 的核心主张

2017 年论文《Attention Is All You Need》用注意力取代循环和卷积作为序列交互机制。**不是整个网络只剩 Attention**：逐位置 FFN、残差、归一化与位置表示仍然承担重要职责。它的优势：

- **并行化训练**：teacher forcing 下可同时计算序列位置的表示，去掉 RNN 的时间步串行依赖；实际速度收益取决于硬件、长度与实现，生成新 token 仍有自回归依赖。
- **可见位置的短路径**：密集注意力中，未被 mask 禁止的一对位置能在一个子层直接交互。因果注意力不能从未来取信息；短路径也不保证模型会检索到正确内容。
- **规整的扩展方式**：层、宽度与数据量便于扩大，矩阵算子便于优化；训练能否稳定仍取决于初始化、归一化、优化器、数据与并行方案，见 [缩放定律](/pretraining/scaling-law)。

代价是**自注意力的复杂度是序列长度的平方 O(n²)**，长序列开销大——这也催生了 [FlashAttention](/advanced/flash-attention)、稀疏/滑窗注意力、[长上下文](/basics/long-context) 等一系列优化。

| 维度 | RNN/LSTM | Transformer |
| --- | --- | --- |
| 时间维并行 | 标准递归状态逐步依赖 | teacher forcing 下可并行；生成仍逐 token |
| 信息交互路径 | 通常随距离增长 | 密集注意力中可见位置直接交互 |
| 长度相关成本 | 固定宽度下通常线性 | 密集注意力核心通常平方级 |
| 状态与资源取舍 | 递归状态可固定大小，但可能压缩细节 | KV 随历史增长，更直接保留可寻址表示 |

## 二、整体架构

原始 Transformer 是 **Encoder-Decoder（编码器-解码器）** 结构，用于机器翻译。论文基础配置两侧各堆叠 N=6 个结构相同的层；**结构相同不等于参数共享**。

```
   输入序列                              输出序列(右移)
      │                                     │
 ┌────▼─────┐                          ┌────▼─────┐
 │ Embedding│                          │ Embedding│
 │  + 位置编码│                          │  + 位置编码│
 └────┬─────┘                          └────┬─────┘
      │                                     │
 ┌────▼──────────┐  ┌──────────────┐   ┌───▼───────────────┐
 │ Encoder × N   │  │              │   │ Decoder × N       │
 │ ┌───────────┐ │  │              │   │ ┌───────────────┐ │
 │ │多头自注意力 │ │  │   K, V      │   │ │掩码多头自注意力 │ │
 │ ├───────────┤ │  │   ───────────┼──▶│ ├───────────────┤ │
 │ │  FFN      │ │  │              │   │ │ 交叉注意力      │ │
 │ └───────────┘ │  │              │   │ ├───────────────┤ │
 │ (每子层: 残差  │  │              │   │ │  FFN          │ │
 │  + LayerNorm) │  │              │   │ └───────────────┘ │
 └───────────────┘  └──────────────┘   └───┬───────────────┘
                                            │
                                       ┌────▼─────┐
                                       │ Linear   │
                                       │ + Softmax│ ──▶ 下一个 token 概率
                                       └──────────┘
```

- **Encoder（编码器）**：每层 = 「多头自注意力 + FFN」两个子层，双向注意力（能看到全序列），负责把输入编码成富含上下文的表示。
- **Decoder（解码器）**：每层 = 「掩码多头自注意力 + 交叉注意力 + FFN」三个子层。掩码保证自回归性；交叉注意力让解码器关注编码器的输出。
- 每个子层都包了 **残差连接 + LayerNorm**。

按使用哪部分，现代模型分三类（详见下文 §6）：Encoder-only（BERT）、Decoder-only（GPT/LLaMA）、Encoder-Decoder（T5）。

## 三、输入表示

### 3.1 Token Embedding

文本先被 [Tokenizer](/basics/tokenizer) 切成 token 并映射为整数 ID，再经过一个可学习的嵌入矩阵 `E ∈ R^{V×d}`（V 是词表大小，d 是模型维度 d_model），把每个 token ID 变成一个 d 维向量。

### 3.2 位置编码（Positional Encoding）

**无位置编码和位置相关 mask 的自注意力是「置换等变」的**——打乱输入，输出相应打乱，而不是输出不变。位置编码为表示补充顺序信息；固定因果 mask 也引入位置约束，不能忽略该假设。

原始 Transformer 用**正弦位置编码**（不同频率的 sin/cos），加到词嵌入上。许多 Decoder-only 模型用 **RoPE（旋转位置编码）**，在注意力内部旋转 Q/K，使其点积包含相对位置信息；不通常旋转 V，也不意味着能无条件超出训练长度。详见 [位置编码](/basics/position-encoding)。

## 四、核心组件深入

### 4.1 自注意力（Self-Attention）

直觉：一个 token 的表示需要上下文。自注意力让它根据可学习的匹配分数，从**允许访问的位置**聚合信息；分数不是外部事实相关性的保证。

每个 token 的输入向量分别乘以三个可学习矩阵 `W_Q, W_K, W_V`，得到 **Query（查询）、Key（键）、Value（值）**，再按下式计算：

$$\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}+M\right)V$$

这里 softmax 沿 key 维执行，$M$ 是加性 mask：可见位置为 0，不可见位置为 $-\infty$。每行至少有一个可见 key；式子省略了训练时的 attention dropout。

逐步拆解：

1. `QKᵀ`：每个 token 的 Q 与所有 token 的 K 做点积，得到 n×n 的**注意力分数矩阵**（相关性）。
2. `/√d_k`：缩放，防止点积过大（见下）。
3. `+M` 后再 `softmax`：按行归一化成注意力权重（dropout 前每行和为 1）。
4. `×V`：用权重对所有 token 的 V 加权求和，得到每个 token 的输出。

**类比**：图书检索中，Q 是检索词、K 是每本书的标签、Q·K 衡量匹配度、V 是书的内容，最终按匹配度把内容加权取回。

**为什么除以 √d_k？** 在 Q/K 分量独立、零均值、单位方差的初始化近似下，点积方差随 d_k 增长，softmax 更容易饱和。缩放将这一尺度拉回常数量级，是稳定性设计而非训练后方差恒为 1 的保证；下文给出推导与排障量。

**为什么要 Q、K、V 三个不同矩阵？** 解耦「用什么去查（Q）、拿什么被查（K）、查到后取什么（V）」三种角色，让模型表达力更强、可分别学习。若直接用输入向量两两点积，表达力受限。

### 4.2 多头注意力（Multi-Head Attention, MHA）

不止做一次注意力，而是把 Q/K/V 投影到 **h 个低维子空间**并行做注意力，再拼接、做一次线性变换：

$$\text{MultiHead}(Q,K,V)=\text{Concat}(\text{head}_1,...,\text{head}_h)W^O$$

- 标准 MHA 每个头的维度通常是 `d_head = d_model / h`。固定总宽度时，主要矩阵乘算术量与单个宽头相近；头数仍会影响 score 中间量和内核效率。
- **维度走查**（设 d_model=512, h=8, 序列长 n）：输入 `(n, 512)` → 每个头的 Q/K/V `(n, 64)` → 每个头输出 `(n, 64)` → 拼接回 `(n, 512)` → 经 W^O 输出 `(n, 512)`。

**为什么要多头？** 多组投影让模型同时形成不同的匹配与聚合模式。某些头可能呈现语法或指代偏好，但不能预先给每个头分配固定语义；它们也可能冗余。价值在于多种路由模式，而不是头数越多越好。

> 现代模型为省 KV Cache 显存，演化出 **MQA / GQA / MLA** 等共享/压缩 KV 的变体，详见 [Attention 与变体](/basics/attention)。

### 4.3 因果掩码与 Padding 掩码

- **因果掩码（Causal/Masked）**：训练中位置 i 的表示可看输入位置 j≤i，并用于预测位置 i+1。完整方阵可将严格上三角置为 −∞；带缓存的矩形注意力必须按实际位置索引对齐，不能直接照搬方阵三角 mask。
- **Padding 掩码**：禁止有效 query 读取填充 key。填充 query 的输出不一定自动归零，还要在 loss 或池化时忽略；packed 样本如需互相隔离，还要加入样本边界 mask。

布尔值本身不说明语义：PyTorch SDPA 的 `True` 表示允许参与注意力，`MultiheadAttention.key_padding_mask` 的 `True` 表示屏蔽。迁移 API 时先核对所用版本，再用很小的可见性矩阵验证。

### 4.4 前馈网络（FFN / MLP）

注意力子层之后是逐位置的前馈网络：对每个位置**独立**地过两层全连接，中间通常放大到 4×d_model 再降回：

$$\text{FFN}(x) = \text{Activation}(xW_1 + b_1)W_2 + b_2$$

- 提供模型的**非线性表达能力**。标准 MHA 加 `d→4d→d` FFN 时，FFN 约占 block 主参数的 2/3；计入词表、改用 GQA/MoE 或改变中间维度后，比例不同。
- 原文用 ReLU；许多模型用 **SwiGLU**：两路投影门控相乘，再向下投影，共 3 个矩阵。取中间维度约 `8d/3` 才与上述 FFN 参数预算相近，实际宽度还受配置与硬件对齐约束，详见 [归一化与激活](/basics/normalization)。
- 一个常见解读：注意力负责「token 之间交流信息」，FFN 负责「对每个 token 做特征变换/知识存储」（很多事实知识被认为存在 FFN 里）。

### 4.5 残差连接与归一化

- **残差连接（Residual）**：`x + Sublayer(x)`，让梯度能跨层「直通」，缓解深层网络梯度消失，是能堆几十上百层的关键。
- **LayerNorm**：通常对每个 token 的隐藏特征维归一化，不混合 batch 或时间位置。这避免了跨样本统计依赖；BatchNorm 推理通常使用运行统计，并非必须在每个 decode 步重算 batch 统计。
- 许多 Decoder-only 模型用 **RMSNorm + Pre-Norm**。RMSNorm 不减均值，运算较简；Pre-Norm 改变残差支路中的归一化位置，通常改善深层优化。实际耗时和稳定性仍需结合实现与配方判断。原文是 Post-Norm。详见 [归一化与激活](/basics/normalization)。

## 五、一次完整的前向传播（Decoder-only 视角）

以带 RoPE、Pre-Norm 的 Decoder-only 走一遍，输入 "我爱"。下面是**流程伪代码，不可直接运行**；为便于看形状，假设 tokenizer 恰好产生两个 token，真实分词可能不同。各层结构相同但参数不同，生成时使用固定权重、关闭 dropout：

```
1. Tokenize:    "我爱" → [token_我, token_爱]
2. Embedding:   每个 token → d 维向量，得到 (2, d)
3. (RoPE 在注意力内注入位置)
4. 进入 L 个 Decoder 层，每层:
     x = x + CausalAttention(Norm_attn(x), positions, cache)
     x = x + FFN(Norm_ffn(x))
5. 最后一层输出 (2, d) → 取最后一个位置(token_爱)的向量
6. 经过 Norm + LM Head(Linear d→V) → logits (V 维)
7. Softmax → 词表上的概率分布 → 采样/贪心选出下一个 token(如 "你")
8. 将选中的 token ID 加到序列，新 token 经 Embedding 和各层处理
   使用缓存时只计算新增位置，历史 K/V 保留；遇到结束条件便停止
```

注意第 6 步：LM Head 可以与输入 Embedding **共享权重（weight tying）**，也可以独立训练；是否共享须查配置，不能由 Decoder-only 名称推断。带缓存的第 4 步会读取各层历史 K/V，详见 [KV Cache](/inference/inference-optimization)。若权重、前缀或位置定义改变，不能继续盲用旧缓存。实际服务还可能因最大输出长度或自定义停止规则结束，而非一定产生 EOS。

## 六、三类架构与「为什么 Decoder-only 赢了」

| 类型 | 代表 | 注意力 | 预训练目标 | 擅长 |
| --- | --- | --- | --- | --- |
| Encoder-only | BERT | 双向 | MLM（掩码还原） | 理解：分类、NER、检索 |
| Decoder-only | GPT、LLaMA | 单向（因果） | CLM（预测下一 token） | 生成、对话 |
| Encoder-Decoder | T5、BART | 编码双向+解码单向 | Span 还原等 | 翻译、摘要 |

**为什么通用自回归生成常采用 Decoder-only？** 应解释需求与训练目标的匹配，而不是宣布所有任务的架构胜者：

1. **监督构造简单**：下一 token 目标不需人工标注，输入和目标只差一位。并非每个输入位置都有有效标签，也不能据此断言去噪目标的数据利用率必然低。
2. **统一生成接口**：prompt 与输出使用同一序列表示，便于续写、对话与工具协议；Encoder-Decoder 也能自回归生成，只是源与目标分开表示。
3. **上下文学习不独占**：GPT 系列展示了以文本示例条件化生成的能力，但架构、目标、规模和数据共同影响结果。UL2 等工作说明去噪目标与其他架构也可以支持上下文学习。
4. **工程生态可复用**：同一类 block 容易复用训练并行、KV Cache 与服务优化；这是一种工程便利，不是稳定性或成本永远更优的定理。
5. **选型看任务证据**：检索、分类可用编码器；明确的源到目标转换可评估 Encoder-Decoder；开放式生成可从 Decoder-only 开始。比较时控制数据、训练预算与解码协议，不把一项零样本结果推广为全面胜利。

> 补充：双向编码器仍用于检索与判别。Embedding 是任务/表示接口，不是单一架构名称；具体模型可能来自编码器，也可能来自生成模型，不能按系列名称统一推断。

## 七、训练目标与损失

Decoder-only 的预训练目标是 **CLM（因果语言建模）**：最大化「给定前文、预测下一个 token」的似然，等价于最小化**交叉熵损失**：

$$\mathcal{L} = -\frac{1}{T}\sum_{t=1}^{T} \log P(x_t \mid x_{<t})$$

这是包含有效预测目标的理想化序列平均；实际训练要处理起始 token、截断、padding 与选择性 loss mask。位置 i 的输入可参与上下文，不代表它一定被计入监督。

**对齐算例**：构造序列 `[a,b,c,eos]`，不额外加 BOS。前三个输入位置分别预测 `[b,c,eos]`，最后位置没有已知的下一 token，忽略该项。可以先在数据层构造输入/目标，也可以交给模型的 loss 实现移位，**只能 shift 一次**。传原始 logits 给交叉熵，不先做 softmax。

<details>
<summary>L1 自测：teacher forcing 是否让模型偷看目标？</summary>

训练时位置 a 的表示只能访问 a，预测 b；位置 b 可访问 a、b，预测 c。所有位置可以同时算，因为各行有不同的因果可见范围。若将 a 位置的标签写成 a，会学成复制输入；若开放未来位置，b 已在可见输入里，会发生泄漏。分别核查 label shift 与 mask，而不是只看 loss 很低。

SFT 可以只对回答区间计 loss，但被忽略的 prompt 仍参与上下文；`ignore_index` 不是注意力屏蔽。这些都是可用小张量检查的协议，不需要先训练大模型。
</details>

## Transformer 深度追问：从公式走到工程

这一节用于回答“公式会写，为什么这样设计、出问题怎么查”的追问。真正的掌握不是复述 QKV，而是能说清张量形状、数值稳定性、训练/推理差异和性能账本。

### 一个 Decoder Block 的张量账本

设 batch 为 `B`、序列长度为 `T`、隐藏维度为 `D`、头数为 `H`、单头维度为 `d_h=D/H`。输入 `X` 的形状为 `(B,T,D)`：

```text
X -> Norm -> Q/K/V: (B,T,H,d_h)
Q @ K^T -> scores: (B,H,T,T)
scores + causal/padding mask -> softmax -> weights
weights @ V -> context: (B,T,H,d_h)
concat + Wo -> (B,T,D) -> residual
Norm -> SwiGLU MLP -> (B,T,D) -> residual
```

工程实现通常把 `Wq`、`Wk`、`Wv` 拼成一次 `Wqkv` 投影，再 reshape/split，降低 kernel launch 和内存读写。数学没有变；GQA/MQA 只让 K/V 的 head 数少于 Q 的 head 数，重点是节约推理 KV cache。

标准 MHA 的 Q/K/V/O 约为 `4D^2`；经典 FFN 的 `D -> 4D -> D` 约为 `8D^2`，因此一层常近似 `12D^2`。SwiGLU 有三块矩阵，为保持参数量相近，中间维常取约 `8D/3`。任何估算都应先声明忽略了 bias、vocab、GQA 和 MoE。

### 为什么除以 `sqrt(d_k)`：方差而不是记忆题

假设 `q_i`、`k_i` 独立、均值为零、方差为一：

$$s=q^Tk=\sum_{i=1}^{d_k}q_i k_i,\qquad Var(s)\approx d_k$$

头维变大时，点积 logit 的标准差按 `sqrt(d_k)` 变大。未经缩放的 softmax 会过早接近 one-hot，非最大位置的梯度接近零。除以 `sqrt(d_k)` 将初始 logit 尺度拉回常数量级，让 softmax 仍处于可学习区域。

训练后的 Q/K 不再独立同分布，RoPE、Norm、温度和数据都会改变 logit 分布。因此排障时应看 attention logits 的均值、最大值和熵，而不是只说“公式里已经除过根号”。

### Q、K、V 分工，以及为什么只缓存 K/V

`QK^T` 负责寻址，`V` 负责被取回的内容。独立投影让“我需要什么”“我能被怎样匹配”“我提供什么信息”处于不同子空间；若共用一个表示，寻址和内容被绑定，表达能力受限。

标准因果 decode 中，新的 query 只需查询已缓存的历史 K/V 及本步 K/V，不再重新计算历史 query 的输出。在固定权重、固定位置定义、逐 token 归一化且关闭 dropout 时，历史 token 不会看到未来，其各层 K/V 可以复用。双向编码器若追加输入，旧表示可能变化，不能直接套用这一论证。缓存避免重算历史投影与旧位置计算，但不会消除读取历史 K/V 的带宽与长度成本。

### 稳定 Softmax：mask 的顺序不能颠倒

稳定实现不是直接 `exp(scores)`，而是：

$$z'=z+mask,\quad m=\max(z'),\quad p_i=\frac{e^{z'_i-m}}{\sum_j e^{z'_j-m}}$$

mask 必须在 softmax 前加到 score 上，使不可见位置概率为零。若 softmax 后再置零，剩余概率和不再为一，除非重新归一化。若一整行所有 key 都被 mask，`max` 和分母会失去有效定义，常导致 NaN；变长 batch、左 padding 和 fused kernel 都应保证每个有效 query 至少有一个可见 key。

FP16/BF16 下还要注意 mask sentinel、score 累积和归约精度。低精度负责高吞吐矩阵乘，softmax 的行最大值、分母和输出累积常使用更高精度路径。更多数值细节见 [训练内部机制与稳定性](/advanced/training-internals)。

### Pre-Norm 的梯度“直通”到底是什么意思

Pre-Norm 写作 `x_{l+1}=x_l+F_l(N(x_l))`，其 Jacobian 近似包含：

$$\frac{\partial x_{l+1}}{\partial x_l}=I+J_{F_l}(N(x_l))J_N(x_l)$$

残差提供恒等项，反向不必在每层先穿过完整子层，因此深层优化更稳定。它不是“梯度绝不会消失”：支路 Jacobian、残差尺度、初始化和学习率仍会累积影响。Pre-Norm 通常还需要 final norm，以控制逐层相加的 residual stream 范数。

Post-Norm 并非错误，而是把 `Norm` 放在相加之后，深层训练更依赖 warmup、初始化和参数化。高分回答应说“现代 decoder-only 多采用 Pre-Norm/RMSNorm 以换取可扩展的稳定性”，而不是把两者简单判成好坏。

### Attention 是 token mixing，MLP 是 channel mixing

Attention 的权重随输入和位置变化，在 token 之间路由信息；FFN/MLP 对每个位置使用共享参数，在通道维做非线性变换。FFN 虽然不直接让 token 相互注意，但它处理的是已被 attention 注入上下文后的 hidden state，二者交替才形成上下文建模。

“知识存于 FFN”可以作为直觉，不是严格的存储地址。事实、算法和指令遵循通常分布在多层 residual stream、attention 路由与 MLP 参数中。面试时避免把这一经验观察说成确定的因果事实。

### 复杂度要拆成计算、激活和带宽

QKV/O 投影和 MLP 约为 `O(BTD^2)`；两次 attention 矩阵乘约为 `O(BT^2D)`。因此 `T` 较小时投影/MLP 可能占主要 FLOPs，长上下文才由 `T^2D` 主导。训练还要保存激活；推理则有随 token 数线性增长的 KV cache。

FlashAttention 仍是精确 softmax attention，通常不把算术复杂度从平方变成线性；它通过分块和 online softmax 避免物化巨大的 `T x T` 矩阵、降低 HBM IO 和激活峰值。线性 attention 则改变或近似计算形式。不要把“快、省显存”误答成“FlashAttention 已把 full attention 变线性”。

### 训练和推理的差别：Teacher Forcing 与 Prefill/Decode

训练时完整真实序列已知，causal mask 限制可见性但所有位置仍可并行计算 next-token loss。推理分为：prefill 并行处理整段 prompt 并建立 KV cache；decode 每次只有一个新 query，却仍要读取并与历史 K/V 交互。KV cache 消除的是历史投影重算，不消除长度相关读取。

Teacher forcing 让模型训练时总看到真实前缀，推理时却要以自己的输出为条件，这就是 exposure bias。低训练 perplexity 不足以证明多轮、工具调用或长链路质量，仍要用任务评测验证。

## Transformer 高频深问

### Q1：多头数越多越好吗？

不一定。总隐藏维固定时，头越多单头维度越小，head 之间也可能冗余。多头价值是多个关系子空间，不是追求最大计数；还要结合 head dimension、GQA 与硬件效率权衡。

### Q2：Causal mask 和 padding mask 能合并吗？

可以在 attention logits 上组合，但语义不同：前者禁止未来 key，后者禁止无效 key。packed sequence 还要禁止跨样本边界。调试时应分别可视化，而不是只看一个最终布尔矩阵。

### Q3：为什么输出是加权和，而不是取最大 V？

加权和可微，能平滑学习多信息源的贡献；硬 argmax 不可微且丢失不确定性。训练初期连续混合是优化能进行的重要前提。

### Q4：为什么没有位置编码就不懂顺序？

无位置表示、无位置相关 mask 时，自注意力对输入排列是置换等变的。绝对位置编码或 RoPE 引入顺序信息，固定因果 mask 本身也引入先后约束；不能将无 mask 的结论无条件套到 Decoder。

### Q5：KV cache 为什么不能无限压缩？

它保存历史的可寻址键值表示。过度压缩会丢失长程依赖所需细节；GQA、MLA、量化、滑窗和淘汰策略都在质量、显存和延迟之间交换，没有零代价方案。

### Q6：为什么长上下文会退化？

训练长度有限时，位置分布、RoPE 相位和注意力模式在长度外可能失配；同时检索噪声、KV cache 容量和 decode 带宽也会放大问题。应按长度分桶评测，而不是只测一个短 prompt。

### Q7：模型重复输出时先查哪里？

先固定 greedy 并保存 logits，分离“模型分布塌缩”和“sampler 配置错误”。前者查 mask、cache、训练数据和 EOS；后者查 temperature、top-p、随机数和重复惩罚。

### Q8：如何估算 KV cache？

标准未压缩 K/V、键值头维相同且各请求缓存长度相同时，全部层粗略为 `2 × B × T × L × H_kv × d_head × bytes`。例如 B=2、T=4096、L=32、H_kv=8、d_head=128、BF16 每元素 2 字节，得到 1,073,741,824 字节，即 1 GiB。它不含权重、分页空洞和工作区；MLA、量化与混合注意力层需按实际布局重算。

## 面试收束回答

> 我理解 Transformer 不只是 QKV 公式。白板上我会先写 `(B,T,D)` 到 `(B,H,T,T)` 的张量变化，再解释 `sqrt(d_k)` 是控制点积方差和 softmax 饱和；随后区分 attention 的 token routing 与 MLP 的 channel mixing。工程上我会把训练与推理解耦：训练用 teacher forcing 和 causal mask 并行计算，推理用 KV cache 做 prefill/decode；性能分析则分开算 `T^2` 计算、激活、KV cache 和 HBM IO。异常排查从 mask、logit 尺度、Norm、dtype 与 cache 生命周期逐层取证，而不是泛泛地说调参。

训练目标的标签对齐与有效位置选择见本页第七节；更完整的数据构造见 [预训练](/pretraining/pretrain)。

## 八、参数量与计算复杂度（实算）

### 8.1 参数量估算

先限定为标准 MHA 与 `d→4d→d` 两矩阵 FFN，忽略偏置与 Norm 小项。此时单层主要参数：

- **注意力**：W_Q, W_K, W_V, W_O 各约 `d²`，合计约 **4d²**。
- **FFN**：两个矩阵 `d×4d` 和 `4d×d`，合计约 **8d²**。
- 单层合计约 **12d²**，L 层即 **12·L·d²**。Embedding 为 `V×d`，独立 LM Head 再加 `V×d`；权重共享时只计一次。

**构造算例（不是某个真实 checkpoint）**：d=4096、L=32、V=32000，采用上述 FFN，且输入/输出权重不共享：
- 主干：`12 × 32 × 4096² = 6,442,450,944`。
- 输入表与独立输出头：`2 × 32000 × 4096 = 262,144,000`。
- 合计约 6.70B；若共享词表权重则约 6.57B。真实模型应逐矩阵核算，不能拿此式冒充 LLaMA 的精确参数账本。

对相同头维的 GQA，设查询头数为 h、KV 头数为 g、d=h·d_head，则注意力主参数为 `2d² + 2d·g·d_head`；门控 FFN 中间宽度为 m 时计 `3dm`。MoE 还须分别报告全部专家参数与每 token 激活参数。

<details>
<summary>L2 自测：增加词表与增加上下文，分别增加哪本账？</summary>

固定 d、层数与结构，将词表 V 加倍，会加倍 Embedding/LM Head 的词表参数，但不会加倍 block 参数；增加上下文长度不改变这些参数。对标准密集注意力，长度加倍使注意力核心算术量约四倍、未压缩 KV 容量约两倍；端到端延迟还受带宽、内核和并发影响。参数、激活与缓存必须分开核算。
</details>

### 8.2 计算复杂度

设序列长 n、维度 d：

- **自注意力**：`QKᵀ` 是 `(n×d)(d×n)=O(n²d)`，乘 V 也是 `O(n²d)` → 注意力对序列长度是**平方级**。
- **FFN**：每个位置 `O(d²)`，n 个位置 `O(n·d²)`。
- 短序列时投影与 FFN 往往占主要算术量，长序列时平方项逐渐突出；交界由宽度、FFN 比例与结构决定。逐 token decode 的单步 query 长度为 1，注意力核心随缓存长度线性增长，不是每步重算一个 n×n 方阵。

训练总计算量粗估 **C ≈ 6 × N × D**：N 为主要参与稠密计算的参数量，D 为训练 token 数，C 单位为 FLOPs。这近似忽略长度相关注意力额外项、激活重算等；MoE 不能直接用全部专家参数当 N。FLOPs 也不是 GPU 小时，换算还需实际有效吞吐，详见 [缩放定律](/pretraining/scaling-law) 与 [GPU 硬件](/inference/gpu-hardware)。

## 九、现代 Transformer 的「标配改造」

下面是常见改造的对照，不是所有模型的强制配置；MLA、GQA 和不同 FFN 结构不应混为一套“标配”。

| 维度 | 原始 Transformer | 常见现代选择 | 详见 |
| --- | --- | --- | --- |
| 归一化 | Post-Norm + LayerNorm | Pre-Norm + RMSNorm | [归一化与激活](/basics/normalization) |
| 激活函数 | ReLU | SwiGLU | [归一化与激活](/basics/normalization) |
| 位置编码 | 正弦绝对编码 | RoPE（+长上下文扩展） | [位置编码](/basics/position-encoding) |
| 注意力 | MHA | GQA / MLA | [Attention 与变体](/basics/attention) |
| 注意力实现 | 朴素 | FlashAttention | [FlashAttention 深入](/advanced/flash-attention) |
| FFN | 稠密 | 稠密 或 MoE（稀疏） | [MoE](/basics/moe) |
| 架构 | Encoder-Decoder | Decoder-only | 本页 §6 |

> 常见现代 Decoder-only 设计组合包括 RMSNorm、Pre-Norm、SwiGLU、RoPE 和 GQA / MLA；不是每个模型都采用全部组件，必须回到具体结构与配置核查。

## 十、高频追问

**Q：Transformer 为什么能取代 RNN？** teacher forcing 下消除递归时间维依赖，并让密集注意力中可见位置直接交互。代价包括平方级注意力计算和随历史增长的 KV；生成仍自回归，短路径也不保证有效记忆。

**Q：Self-Attention 的公式？为什么除以 √d_k？** `softmax(QKᵀ/√d_k + mask)V`。在独立零均值单位方差的近似下控制 logit 尺度，降低饱和风险；不保证训练后的方差恒为 1。

**Q：为什么需要 Q、K、V 三个矩阵？** 解耦「查询/被查/取值」三种角色，分别学习，表达力更强；直接用输入点积会受限。

**Q：多头注意力的作用？头数越多越好吗？** 让模型在不同子空间关注不同模式（语法/指代/语义）。头数不是越多越好——头太多每头维度太小、表达受限，是需要权衡的超参。

**Q：FFN 的作用？为什么中间放大 4 倍？** 提供非线性表达能力、存储知识。放大 4 倍是经验设计（给足非线性容量），并非必须；SwiGLU 因有门控、用 3 矩阵，中间维度常取约 8/3·d。

**Q：Pre-Norm 和 Post-Norm 的区别？** 区别是归一化在子层前还是残差相加后。Pre-Norm 通常改善深层初始化时的梯度行为；Post-Norm 的训练稳定性与 warmup 等配方有关。不要脱离深度、初始化和训练配方判断谁的表达力必然更强。

**Q：为什么用 LayerNorm 不用 BatchNorm？** Transformer 中通常逐 token 在隐藏维归一化，不依赖跨样本或时间的统计，方便变长序列和自回归计算。BatchNorm 推理可用运行统计；不是“推理 batch=1 所以不能工作”。

**Q：为什么主流 LLM 是 Decoder-only？** 对通用续写与对话，它提供简单的下一 token 监督和统一生成接口，也有可复用的工程生态。不代表所有任务最优，或其他架构不会上下文学习；见 §6 的比较边界。

**Q：Encoder 和 Decoder 的注意力有什么区别？** Encoder 是双向自注意力（看全序列）；Decoder 的自注意力带因果掩码（只看前文），且 Encoder-Decoder 结构里 Decoder 还有交叉注意力关注 Encoder 输出。

**Q：交叉注意力（Cross-Attention）是什么？** 在 Encoder-Decoder 中，Decoder 用自己的 Q 去查询 Encoder 输出的 K、V，从而「关注」输入序列。纯 Decoder-only 模型没有交叉注意力。

**Q：Transformer 的复杂度瓶颈在哪？怎么缓解？** 自注意力 O(n²d)，长序列昂贵。缓解：FlashAttention（降访存）、稀疏/滑窗注意力、线性注意力/SSM、GQA/MLA 降 KV、长上下文扩展，详见 [长上下文](/basics/long-context)。

**Q：怎么估算一个 Decoder-only 模型的参数量？** 先列真实矩阵：标准 MHA 加两矩阵 4d FFN 才是每层约 12d²；GQA、门控 FFN 和 MoE 用各自公式。词表输入表与输出头是否共享，决定 Vd 计一次还是两次。

**Q：什么是 weight tying（权重共享）？** 输入表与输出 LM Head 使用同一组词表权重，省一份 Vd 参数；作为结构约束，效果需由实验判断，并非所有模型都启用。

**Q：KV Cache 是什么？和 Transformer 推理什么关系？** 自回归生成时缓存历史 token 的 K、V，避免每步重算，大幅加速；但显存随序列长度线性增长，是长上下文瓶颈。详见 [推理优化](/inference/inference-optimization)。

**Q：Attention 的置换性质是什么？** 无位置编码与位置相关 mask 的自注意力是置换等变：打乱输入，输出相应打乱，而不是输出不变。位置编码和固定因果 mask 会引入顺序信息，见本页 L3 推导。

**Q：一句话概括 Transformer 每个组件的职责？** 注意力让 token 之间「交流信息」、FFN 对每个 token「做变换/存知识」、残差让梯度「跨层流动」、归一化让训练「稳定」、位置编码补上「顺序信息」。
