---
title: Attention 与变体
description: 理解 Attention 的形状、mask、复杂度与数值边界，区分 IO 优化和结构改进。
level: L1
roles:
  - 在校生
  - 算法研究
  - 应用开发
classification: reviewed
---
# Attention 与变体

> 先明确张量形状，再讨论复杂度、缓存与内核。L1 读者先看 QKV 和 mask；L2 关注错误定位和成本；L3 追问等变性、缩放假设与数值误差。前置阅读：[Transformer](/basics/transformer)。

<LessonLab kind="attention" />

## 先把形状与复杂度说准确

标准 MHA 中，设 $Q,K,V$ 均为 $[B,H,T,D]$。$QK^\top$ 是 $[B,H,T,T]$，softmax 沿 key 的最后一维，输出回到 $[B,H,T,D]$。GQA 中 Q 头数与 KV 头数不同，需按分组映射，不能直接假设三个张量头数一样。

| 场景 | Query 长度 | Key 长度 | 注意力核心算术量 |
| --- | --- | --- | --- |
| Prefill | $T$ | $T$ | $O(BHT^2D)$ |
| 带缓存的 Decode 单步 | $1$ | $T$ | $O(BHTD)$ |
| Cross-Attention | $T_q$ | $T_k$ | $O(BHT_qT_kD)$ |

这里只计密集注意力核心，不含 QKV 投影、输出投影、FFN 与调度。FlashAttention 减少中间矩阵的物化和 HBM 往返，并没有把密集注意力的二次算术复杂度变成线性。

## 工程失败：mask 错误比公式背错更难发现

- **整行都被屏蔽**：全部分数为 $-\infty$ 时，直接 softmax 可能得到 NaN。不同内核行为不一定相同；应明确空行策略并覆盖全 padding 样本。
- **mask 布尔语义反了**：PyTorch 的 `scaled_dot_product_attention` 布尔 True 表示允许参与注意力；其他 API 的 True 可能表示需要屏蔽。迁移时必须核对接口，不能机械复用。
- **缓存非方阵因果对齐错误**：Decode 的 query 长度通常为 1，key 长度包含历史；盲用面向方阵的上三角规则可能屏蔽历史或放开未来。用具体位置 ID 构造允许关系，再比较缓存与无缓存基线。
- **评估还在 dropout**：SDPA 会按传入的 `dropout_p` 应用 dropout；推理应显式设为 0，而不是假定模块 `eval()` 自动覆盖函数参数。

## 方案选择，不把所有优化混为一谈

| 方案 | 改变什么 | 核心限制 |
| --- | --- | --- |
| FlashAttention | IO 与中间存储 | 保留密集注意力语义；有浮点舍入与硬件 / 内核差异 |
| GQA / MQA | KV 头的共享方式 | 是结构与训练取舍，不是只换一个推理开关 |
| 滑窗 / 稀疏注意力 | 允许交互的 token 对 | 改变可访问范围，要验证远距离依赖 |
| 线性注意力 | 交互或归一化形式 | 通常不与标准 softmax attention 等价 |

<details>
<summary>L3 追问：缩放为什么是 √D，实验时该验证什么？</summary>

若各维 query 和 key 近似独立、均值为 0、方差为 1，点积是 $D$ 项乘积之和，方差约为 $D$；除以 $\sqrt D$ 让方差回到单位量级。真实训练的表示不严格满足这些假设，因此这是初始化与数值稳定性的动机，不是每一层每一步的精确方差保证。实验应记录 score 分布、softmax 熵和梯度，而不仅比较最终 loss。
</details>

## 一手参考

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)：缩放点积与多头注意力。
- [FlashAttention](https://arxiv.org/abs/2205.14135)：IO-aware exact attention，exact 指不采用注意力近似，并不保证位级一致。
- [PyTorch SDPA 官方接口](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html)：mask、dropout 与内核选择的接口边界，升级版本时重新核查。

下面按机制展开完整参考。

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

**Attention 复杂度为什么是 O(n²)？** 要算每对 token 的分数，n 个 token 两两组合即 n² 量级（再乘维度 d 是 O(n²d)）。这是长序列昂贵的根源，催生了稀疏注意力、FlashAttention 等优化。

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

若不使用缓存，自回归生成会重复处理历史前缀。**KV Cache** 保存各层历史 K、V；新位置仍要计算自己的 Q、K、V，随后用新 Q 读取包含历史和当前位置的 KV。缓存省的是重复投影与前缀计算，不是取消对历史 KV 的读取。

代价：**KV Cache 显存随「序列长度 × 层数 × 头数 × 头维度 × batch」线性增长**，成为长上下文/高并发推理的主要瓶颈。这直接催生了下面对「头」做共享/压缩的一系列变体。详见 [推理优化](/inference/inference-optimization)、[长上下文](/basics/long-context)。

## 五、MHA → MQA → GQA → MLA：省 KV 的演进

| 方案 | K/V 头数 | KV Cache | 质量 | 代表模型 |
| --- | --- | --- | --- | --- |
| **MHA**（多头） | 每个 Q 头各有独立 K/V | 同维度下随 Q 头数增长 | 作为比较基线 | 原始 Transformer、GPT-2 |
| **MQA**（多查询） | 所有 Q 头**共享 1 组** K/V | 同维度下最少 KV 头 | 可能有质量损失 | 部分 PaLM、Falcon 配置 |
| **GQA**（分组查询） | Q 头**分组**，组内共享 K/V | 取决于 KV 组数 | 需同预算评测 | 部分 LLaMA、Qwen 配置 |
| **MLA**（多头潜在） | 缓存联合潜表示及位置部分 | 按潜维度和位置维度计算 | 不可与不同训练模型直接排序 | DeepSeek-V2 等 |

- **MQA**：若头维度、层数和精度相同，KV 项可比 MHA 少 h 倍；这不包含权重与其他显存。
- **GQA**：把 Q 头分成 g 组（g=1 即 MQA，g=h 即 MHA）。[GQA 论文](https://arxiv.org/abs/2305.13245)报告特定 uptraining 设置下接近 MHA 的质量，不代表任何模型随意合并 KV 都无损。
- **MLA**：[DeepSeek-V2](https://arxiv.org/abs/2405.04434)联合压缩 KV，并处理位置分支；高效实现可把部分上投影吸收到查询和输出侧。不能只按「先解压所有 KV」理解其部署收益，详见 [DeepSeek 专题](/models/deepseek)。

构造账本：32 层、8 个 KV 头、每头 128 维、BF16 每元素 2 字节，每 token KV 为 `2 × 32 × 8 × 128 × 2 = 131072 字节 = 128 KiB`。8192 token 单序列约 1 GiB；若改为 32 个 KV 头，则约 4 GiB。未含分页浪费、权重、激活与工作区；MLA 需另用其配置公式。

**为什么主要共享/压缩 K/V？** 历史 Q 通常不需要缓存，KV 则随序列累积。改变 Q 投影也可能节省计算或参数，但不能同样减少历史缓存，且需验证表达能力。

## 六、FlashAttention：让注意力又快又省

**FlashAttention 是 IO 感知的精确注意力算法**：不近似注意力语义，但浮点计算顺序不同可能造成舍入差异。通过分块、online softmax 与融合，避免在 HBM 中物化完整 N×N 分数矩阵；只在 SRAM 中处理当前块。注意力额外中间存储可从二次量级降至线性，算术量仍为密集注意力的二次量级；实际速度取决于硬件与负载。详见 [FlashAttention 深入](/advanced/flash-attention)。

## 七、高效注意力变体（降 O(n²)）

长序列下还有一类「改注意力本身」的方案，详见 [长上下文](/basics/long-context)：

- **滑动窗口注意力**：每个 token 只关注最近 W 个（Mistral），多层叠加扩大有效感受野。
- **稀疏注意力**：只算部分注意力对（局部 + 少量全局），如 Longformer、BigBird。
- **线性注意力**：改变核与归一化形式，见 [线性注意力](/basics/linear-attention)；**SSM** 是另一类状态模型，如 [Mamba](/advanced/state-space-models)，不能直接把两者叫作同一算法。
- **StreamingLLM / Attention Sink**：保留开头几个「汇聚点」token 的 KV + 最近窗口，稳定处理超长流式输入。

## 八、交叉注意力（Cross-Attention）

在 Encoder-Decoder 结构中，Decoder 用**自己的 Q** 去查询 **Encoder 输出的 K、V**，从而「关注」输入序列（如翻译时对齐源语言）。纯 Decoder-only 模型没有交叉注意力。多模态里也用交叉注意力把视觉特征注入语言模型（见 [多模态](/multimodal/multimodal)）。

## 九、高频追问

**Q：Self-Attention 的公式与每一步含义？** `softmax(QKᵀ/√d_k)V`：QKᵀ 算两两相关性 → 缩放 → softmax 归一化成权重 → 对 V 加权求和。

**Q：为什么除以 √d_k？** 防止点积方差随维度增大而变大、使 softmax 饱和导致梯度消失。把方差归一到 1 量级，稳定训练。

**Q：为什么要 Q、K、V 三个矩阵？** 解耦「查询/被查/取值」三种角色分别学习，表达力更强；直接点积会对称且受限。

**Q：MHA、MQA、GQA、MLA 的区别？** MHA 每个 Q 头有独立 KV；MQA 共享一组 KV；GQA 按组共享；MLA 使用共享压缩表示与位置部分。缓存大小可按结构核算，质量比较必须控制数据、训练与任务，不直接排序为「最好」或「无损」。

**Q：为什么 MQA/GQA 主要共享 K/V？** 历史 KV 是累计缓存；Q 只服务当前查询。改变 Q 也可能影响计算量，但不是同一种缓存优化。

**Q：KV Cache 是什么？为什么是长上下文瓶颈？** 缓存历史 token 的 K、V 避免重算，加速自回归生成；但显存随序列长度线性增长，长上下文/高并发下成为主要瓶颈。对策：GQA/MQA/MLA、KV 量化、PagedAttention。

**Q：多头注意力头数越多越好吗？** 不是。固定 d_model 下头越多每头维度越小、单头表达越弱；需权衡。常见做法是 d_head 取 64/128。

**Q：FlashAttention 是近似吗？为什么快？** 不近似注意力语义，但不保证浮点结果位级相同。分块与 online softmax 避免物化完整分数矩阵，减少 HBM 往返；收益需结合 Prefill / Decode、形状与内核实测。

**Q：Attention 为什么是 O(n²)？怎么缓解？** 需算每对 token 的分数。缓解：FlashAttention（降访存）、稀疏/滑窗注意力、线性注意力/SSM、长上下文扩展。

**Q：自注意力和交叉注意力的区别？** 自注意力的 Q、K、V 来自同一序列；交叉注意力的 Q 来自一个序列（如 Decoder）、K/V 来自另一个序列（如 Encoder 输出），用于跨序列对齐。

**Q：因果掩码怎么实现？** 把注意力分数矩阵的上三角（未来位置）置为 −∞，softmax 后这些位置权重为 0，从而每个 token 只能注意到自己及之前的位置。
