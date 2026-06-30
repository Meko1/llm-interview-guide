# Transformer 架构详解

> Transformer 是几乎所有大模型的基石，也是面试出现频率最高的考点。本文从历史动机讲到每个组件的原理，再到完整的前向走查、参数量与计算复杂度的实算、现代改进与高频追问，力求一篇讲透。Attention、位置编码、归一化等子主题有独立深入页，本文负责把它们串成完整图景。

![Transformer Decoder-Only 块结构：残差直通 + Pre-Norm](/diagrams/transformer.svg)

## 一、为什么会有 Transformer？

### 1.1 RNN/LSTM 时代的瓶颈

在 Transformer（2017）之前，序列建模主流是 RNN/LSTM/GRU。它们按时间步**串行**处理序列：第 t 步的输出依赖第 t−1 步的隐藏状态。这带来三个根本问题：

- **无法并行**：必须算完第 t 步才能算第 t+1 步，训练无法充分利用 GPU 的并行能力，长序列训练极慢。
- **长距离依赖衰减**：信息要一步步传递，距离越远越容易梯度消失/爆炸，「记不住」很久以前的内容。LSTM 的门控机制只是缓解，没有根治。
- **信息瓶颈**：seq2seq 把整个输入压缩成一个固定向量再解码，长输入信息丢失严重。

2014–2015 年，**Attention 机制**被引入 seq2seq，让解码器在每一步能「回看」编码器的所有隐藏状态、按需加权——大幅缓解了信息瓶颈。但模型主干仍是 RNN，串行问题还在。

### 1.2 Transformer 的核心主张

2017 年论文《Attention Is All You Need》提出：**完全抛弃循环和卷积，只用注意力机制来建模序列**。它的优势：

- **并行化训练**：对整个序列**同时**计算注意力，充分利用 GPU，训练速度数量级提升。
- **任意距离 O(1) 路径**：序列中任意两个位置之间可以直接交互，路径长度恒为 1，长距离依赖建模能力极强。
- **可扩展性**：结构规整、易堆叠，配合 [缩放定律](/pretraining/scaling-law) 能稳定放大到千亿参数。

代价是**自注意力的复杂度是序列长度的平方 O(n²)**，长序列开销大——这也催生了 [FlashAttention](/advanced/flash-attention)、稀疏/滑窗注意力、[长上下文](/basics/long-context) 等一系列优化。

| 维度 | RNN/LSTM | Transformer |
| --- | --- | --- |
| 并行性 | 差（时间步串行） | 好（整序列并行） |
| 长距离依赖 | 弱（逐步衰减） | 强（O(1) 路径） |
| 序列复杂度 | O(n) | O(n²) |
| 可扩展性 | 一般 | 极强 |

## 二、整体架构

原始 Transformer 是 **Encoder-Decoder（编码器-解码器）** 结构，用于机器翻译。两侧各由 N 个相同的层堆叠（原文 N=6）。

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

**Attention 本身是「置换不变」的**——打乱输入顺序，输出只会相应打乱，模型无法区分「我打你」和「你打我」。因此必须显式注入位置信息。

原始 Transformer 用**正弦位置编码**（不同频率的 sin/cos），加到词嵌入上。现代大模型主流用 **RoPE（旋转位置编码）**，作用在注意力内部、兼具绝对与相对位置优点、外推性好。详见 [位置编码](/basics/position-encoding)。

## 四、核心组件深入

### 4.1 自注意力（Self-Attention）

直觉：理解一句话时，每个词的含义都依赖上下文。自注意力让每个 token 根据「相关程度」从其他所有 token 聚合信息。

每个 token 的输入向量分别乘以三个可学习矩阵 `W_Q, W_K, W_V`，得到 **Query（查询）、Key（键）、Value（值）**，再按下式计算：

$$\text{Attention}(Q,K,V)=\text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

逐步拆解：

1. `QKᵀ`：每个 token 的 Q 与所有 token 的 K 做点积，得到 n×n 的**注意力分数矩阵**（相关性）。
2. `/√d_k`：缩放，防止点积过大（见下）。
3. `softmax`：按行归一化成注意力权重（每行加起来为 1）。
4. `×V`：用权重对所有 token 的 V 加权求和，得到每个 token 的输出。

**类比**：图书检索中，Q 是检索词、K 是每本书的标签、Q·K 衡量匹配度、V 是书的内容，最终按匹配度把内容加权取回。

**为什么除以 √d_k？** 当维度 d_k 较大时，Q·K 是 d_k 个随机数的和，方差约为 d_k，点积绝对值会变大，使 softmax 进入梯度极小的饱和区（接近 one-hot），训练不稳定、梯度消失。除以 √d_k 把方差拉回 1 量级，保持 softmax 在敏感区。

**为什么要 Q、K、V 三个不同矩阵？** 解耦「用什么去查（Q）、拿什么被查（K）、查到后取什么（V）」三种角色，让模型表达力更强、可分别学习。若直接用输入向量两两点积，表达力受限。

### 4.2 多头注意力（Multi-Head Attention, MHA）

不止做一次注意力，而是把 Q/K/V 投影到 **h 个低维子空间**并行做注意力，再拼接、做一次线性变换：

$$\text{MultiHead}(Q,K,V)=\text{Concat}(\text{head}_1,...,\text{head}_h)W^O$$

- 每个头的维度通常是 `d_head = d_model / h`，所以 h 个头的总计算量与单头（d_model 维）相近。
- **维度走查**（设 d_model=512, h=8, 序列长 n）：输入 `(n, 512)` → 每个头的 Q/K/V `(n, 64)` → 每个头输出 `(n, 64)` → 拼接回 `(n, 512)` → 经 W^O 输出 `(n, 512)`。

**为什么要多头？** 让模型在不同子空间关注不同类型的关系——有的头看局部语法、有的头看长程指代、有的头看实体共现。类似 CNN 的多个卷积核各司其职，比单头表达更丰富。

> 现代模型为省 KV Cache 显存，演化出 **MQA / GQA / MLA** 等共享/压缩 KV 的变体，详见 [Attention 与变体](/basics/attention)。

### 4.3 因果掩码与 Padding 掩码

- **因果掩码（Causal/Masked）**：Decoder 生成第 t 个 token 时不能看到未来。实现上把注意力分数矩阵的**上三角置为 −∞**，softmax 后变 0。这是自回归生成的关键。
- **Padding 掩码**：batch 内序列长度不齐，对填充的 `<pad>` 位置做掩码，避免它们参与注意力。

### 4.4 前馈网络（FFN / MLP）

注意力子层之后是逐位置的前馈网络：对每个位置**独立**地过两层全连接，中间通常放大到 4×d_model 再降回：

$$\text{FFN}(x) = \text{Activation}(xW_1 + b_1)W_2 + b_2$$

- 提供模型的**非线性表达能力**，也是参数量的主要来源之一（约占 Decoder-only 模型参数的 2/3）。
- 原文用 ReLU；现代大模型多用 **SwiGLU**（带门控，效果更好，用 3 个矩阵、中间维度取约 8/3·d 以保持参数量），详见 [归一化与激活](/basics/normalization)。
- 一个常见解读：注意力负责「token 之间交流信息」，FFN 负责「对每个 token 做特征变换/知识存储」（很多事实知识被认为存在 FFN 里）。

### 4.5 残差连接与归一化

- **残差连接（Residual）**：`x + Sublayer(x)`，让梯度能跨层「直通」，缓解深层网络梯度消失，是能堆几十上百层的关键。
- **LayerNorm**：在单个样本的特征维做归一化，稳定训练（不用 BatchNorm 因为序列变长、batch 统计不稳）。
- 现代大模型多用 **RMSNorm**（更省算力）+ **Pre-Norm**（归一化放子层之前，训练更稳、能堆更深）。原文是 Post-Norm。详见 [归一化与激活](/basics/normalization)。

## 五、一次完整的前向传播（Decoder-only 视角）

以现代主流的 Decoder-only（如 GPT/LLaMA）走一遍，输入 "我爱"：

```
1. Tokenize:    "我爱" → [token_我, token_爱]
2. Embedding:   每个 token → d 维向量，得到 (2, d)
3. (RoPE 在注意力内注入位置)
4. 进入 L 个相同的 Decoder 层，每层:
     x = x + MHA(Norm(x))      # 掩码自注意力 + 残差   (Pre-Norm)
     x = x + FFN(Norm(x))      # 前馈 + 残差
5. 最后一层输出 (2, d) → 取最后一个位置(token_爱)的向量
6. 经过 Norm + LM Head(Linear d→V) → logits (V 维)
7. Softmax → 词表上的概率分布 → 采样/贪心选出下一个 token(如 "你")
8. 把 "你" 拼回输入，重复 4–7（自回归），直到生成 <eos>
```

注意第 6 步：LM Head 的权重常与输入 Embedding 矩阵**共享（weight tying）**，省参数且效果略好。推理时第 4 步会用 [KV Cache](/inference/inference-optimization) 缓存历史 K/V，避免重复计算。

## 六、三类架构与「为什么 Decoder-only 赢了」

| 类型 | 代表 | 注意力 | 预训练目标 | 擅长 |
| --- | --- | --- | --- | --- |
| Encoder-only | BERT | 双向 | MLM（掩码还原） | 理解：分类、NER、检索 |
| Decoder-only | GPT、LLaMA | 单向（因果） | CLM（预测下一 token） | 生成、对话 |
| Encoder-Decoder | T5、BART | 编码双向+解码单向 | Span 还原等 | 翻译、摘要 |

**为什么主流 LLM 都是 Decoder-only？** 这是高频深问：

1. **训练目标统一且高效**：「预测下一个 token」对每个位置都有监督信号，能充分利用所有文本数据；Encoder-Decoder 的目标更复杂、数据利用率低。
2. **天然适配生成与对话**：自回归本身就是生成范式，无需编解码切换。
3. **In-context learning 更强**：Decoder-only 在 few-shot / 上下文学习上表现更好（GPT-3 验证）。
4. **规模扩展更稳定、工程更简单**：结构单一，易于放大和优化（KV Cache、并行）。
5. **零样本泛化好**：研究（如 Wang et al.）表明，纯语言建模目标下 Decoder-only 的零样本能力最强。

> 补充：双向的 BERT 类模型并未消失，仍是检索、Embedding、判别任务的主力（如 BGE 系列就源自 BERT 类编码器）。

## 七、训练目标与损失

Decoder-only 的预训练目标是 **CLM（因果语言建模）**：最大化「给定前文、预测下一个 token」的似然，等价于最小化**交叉熵损失**：

$$\mathcal{L} = -\frac{1}{T}\sum_{t=1}^{T} \log P(x_t \mid x_{<t})$$

每个位置都贡献一个损失项（teacher forcing：训练时用真实前文而非模型自己的输出）。详见 [预训练](/pretraining/pretrain)。

## 八、参数量与计算复杂度（实算）

### 8.1 参数量估算

对 Decoder-only 模型，单层主要参数（忽略偏置、Norm 的少量参数）：

- **注意力**：W_Q, W_K, W_V, W_O 各约 `d²`，合计约 **4d²**。
- **FFN**：两个矩阵 `d×4d` 和 `4d×d`，合计约 **8d²**。
- 单层合计约 **12d²**，L 层即 **12·L·d²**，再加上 Embedding（`V×d`）。

**实算示例（LLaMA-7B：d=4096, L=32, V≈32000）**：
- 主干：`12 × 32 × 4096² ≈ 12 × 32 × 16.7M ≈ 6.4B`
- 加 Embedding：`32000 × 4096 ≈ 0.13B`
- 量级与 7B 相符（实际因 SwiGLU 用 3 个矩阵、GQA 等略有出入）。

### 8.2 计算复杂度

设序列长 n、维度 d：

- **自注意力**：`QKᵀ` 是 `(n×d)(d×n)=O(n²d)`，乘 V 也是 `O(n²d)` → 注意力对序列长度是**平方级**。
- **FFN**：每个位置 `O(d²)`，n 个位置 `O(n·d²)`。
- 当 n ≪ d 时 FFN 主导；当 n 很大时注意力的 n² 项主导，这就是长序列昂贵的根源。

训练总计算量经验公式：**C ≈ 6 × N × D**（N 参数量、D 训练 token 数，每 token 前向+反向约 6N 次浮点运算），用于算力预算估算，详见 [缩放定律](/pretraining/scaling-law) 与 [GPU 硬件](/inference/gpu-hardware)。

## 九、现代 Transformer 的「标配改造」

原始 Transformer（2017）到现代 LLaMA/Qwen 类模型，关键升级：

| 维度 | 原始 Transformer | 现代主流 | 详见 |
| --- | --- | --- | --- |
| 归一化 | Post-Norm + LayerNorm | Pre-Norm + RMSNorm | [归一化与激活](/basics/normalization) |
| 激活函数 | ReLU | SwiGLU | [归一化与激活](/basics/normalization) |
| 位置编码 | 正弦绝对编码 | RoPE（+长上下文扩展） | [位置编码](/basics/position-encoding) |
| 注意力 | MHA | GQA / MLA | [Attention 与变体](/basics/attention) |
| 注意力实现 | 朴素 | FlashAttention | [FlashAttention 深入](/advanced/flash-attention) |
| FFN | 稠密 | 稠密 或 MoE（稀疏） | [MoE](/basics/moe) |
| 架构 | Encoder-Decoder | Decoder-only | 本页 §6 |

> 一句话记忆：**现代 Decoder-only 标配 = RMSNorm + Pre-Norm + SwiGLU + RoPE + GQA/MLA +（可选）MoE。**

## 十、高频追问

**Q：Transformer 为什么能取代 RNN？** 并行训练（不必时间步串行）、长距离依赖建模（任意位置 O(1) 路径）、可扩展性强。代价是注意力 O(n²)。

**Q：Self-Attention 的公式？为什么除以 √d_k？** `softmax(QKᵀ/√d_k)V`。除以 √d_k 把点积方差拉回 1 量级，防止 softmax 进入梯度极小的饱和区，稳定训练。

**Q：为什么需要 Q、K、V 三个矩阵？** 解耦「查询/被查/取值」三种角色，分别学习，表达力更强；直接用输入点积会受限。

**Q：多头注意力的作用？头数越多越好吗？** 让模型在不同子空间关注不同模式（语法/指代/语义）。头数不是越多越好——头太多每头维度太小、表达受限，是需要权衡的超参。

**Q：FFN 的作用？为什么中间放大 4 倍？** 提供非线性表达能力、存储知识。放大 4 倍是经验设计（给足非线性容量），并非必须；SwiGLU 因有门控、用 3 矩阵，中间维度常取约 8/3·d。

**Q：Pre-Norm 和 Post-Norm 的区别？** Post-Norm（原文）表达力强但深层难训、需 warmup；Pre-Norm 梯度经残差直通、训练稳、能堆更深，是现代主流，代价是表达力略弱。

**Q：为什么用 LayerNorm 不用 BatchNorm？** 序列变长、batch 内样本长度不齐、自回归推理时 batch 统计不稳；LayerNorm 在单样本特征维归一化，与 batch 和序列长度无关，更稳定。

**Q：为什么主流 LLM 是 Decoder-only？** 训练目标统一高效、天然适配生成与对话、in-context learning 强、规模扩展稳定、零样本泛化好。（见 §6 展开）

**Q：Encoder 和 Decoder 的注意力有什么区别？** Encoder 是双向自注意力（看全序列）；Decoder 的自注意力带因果掩码（只看前文），且 Encoder-Decoder 结构里 Decoder 还有交叉注意力关注 Encoder 输出。

**Q：交叉注意力（Cross-Attention）是什么？** 在 Encoder-Decoder 中，Decoder 用自己的 Q 去查询 Encoder 输出的 K、V，从而「关注」输入序列。纯 Decoder-only 模型没有交叉注意力。

**Q：Transformer 的复杂度瓶颈在哪？怎么缓解？** 自注意力 O(n²d)，长序列昂贵。缓解：FlashAttention（降访存）、稀疏/滑窗注意力、线性注意力/SSM、GQA/MLA 降 KV、长上下文扩展，详见 [长上下文](/basics/long-context)。

**Q：怎么估算一个 Decoder-only 模型的参数量？** 单层约 12d²（注意力 4d² + FFN 8d²），乘层数 L 再加 Embedding（V×d）。如 LLaMA-7B：12×32×4096²≈6.4B + Embedding。

**Q：什么是 weight tying（权重共享）？** 输入 Embedding 矩阵与输出 LM Head 共享同一权重，省参数（V×d 很大）且通常略提效果。

**Q：KV Cache 是什么？和 Transformer 推理什么关系？** 自回归生成时缓存历史 token 的 K、V，避免每步重算，大幅加速；但显存随序列长度线性增长，是长上下文瓶颈。详见 [推理优化](/inference/inference-optimization)。

**Q：Attention 是置换不变的，这意味着什么？** 不加位置编码时，打乱输入顺序输出只会相应打乱，模型分不清词序。所以必须显式注入位置信息（位置编码/RoPE）。

**Q：一句话概括 Transformer 每个组件的职责？** 注意力让 token 之间「交流信息」、FFN 对每个 token「做变换/存知识」、残差让梯度「跨层流动」、归一化让训练「稳定」、位置编码补上「顺序信息」。
