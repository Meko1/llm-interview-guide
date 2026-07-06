# 扩散语言模型（Diffusion LLM）

> 主流大模型清一色都是**自回归**（Autoregressive, AR）—— 从左到右逐 token 生成。2025 年 Inception Labs 的 Mercury、蚂蚁/中国人大的 LLaDA 把**扩散模型**这一在图像领域大杀四方的范式搬到了文本上：**并行**生成、**双向**上下文、**任意顺序**填空。这是当下最"反直觉"的前沿方向之一，也是进阶面试的加分题。相关前置阅读：[扩散模型与图像生成](/multimodal/diffusion)、[状态空间模型与 Mamba](/advanced/state-space-models)、[解码与采样策略](/basics/decoding)。

## 面试先背这几句话

- **一句话定义**：扩散语言模型（Diffusion LLM / DLM）通过**离散扩散**（多轮 mask/unmask 或 token 替换）迭代地把噪声还原成文本，与自回归的"逐 token 从左到右"完全不同。
- **两大杀手锏**：① **并行解码**——一次 forward 输出多个 token，Mercury 官方公布在 H100 上超 1000 tokens/s；② **双向条件**——生成任一 token 时能看到左右两边，天然适合**代码填洞（fill-in-the-middle）、编辑、约束满足**类任务。
- **两个代价**：① 训练/推理 loss 与目标不对齐（需要多轮 denoise），单位 token 训练算力比 AR 高；② **精确长文本一致性**目前仍弱于顶级 AR 模型，长上下文推理与规划能力还在追赶。
- **代表工作**：LLaDA-8B（人大/蚂蚁）、Mercury Coder（Inception Labs）、SEDD、DiffuLLaMA、Dream 7B、Score Entropy Discrete Diffusion。

## 一、为什么要挑战自回归？

自回归的三大痛点直接对应 DLM 的三大卖点：

| 自回归的痛 | DLM 的解法 |
| --- | --- |
| 逐 token 串行，长文本延迟高 | **一次生成多 token**（并行），理论上 10-20× 加速 |
| 单向 causal mask，右边看不到 | **双向注意力**，任意位置都能看到全序列，编辑/填洞天然强 |
| 一步错步步错，无法回头修正 | **多轮迭代 refine**，前几轮定"骨架"、后几轮定"细节"，类似人类写作 |

反过来，自回归的强项——精确的 next-token 条件概率、成熟的 KV Cache 生态、稳定的长文本一致性——恰恰是 DLM 目前的短板。DLM 与 AR 不是"谁替代谁"，而是**推理速度 / 编辑灵活性 vs 生成质量 / 生态成熟度**的取舍。

## 二、离散扩散：文本版的加噪与去噪

图像扩散是往像素里加**连续高斯噪声**、再学去噪。文本是**离散**的 token，不能直接加高斯噪声，主流做法是两条路：

### 2.1 Masking Diffusion（掩码扩散，主流）

**前向过程**：把训练句子中 x 比例的 token 替换成 `[MASK]`（x 从 0 一路涨到接近 1）——这与 BERT 的 MLM 是同一个操作，只是**变成了一个连续可调的时间步 t**：t=0 完全原文、t=T 全部 mask。

**反向过程**：训练一个 Transformer，在给定"部分被 mask 的句子 + 时间步 t"时，**同时预测所有被 mask 的位置**。推理时：

1. 从**全 mask** 序列出发；
2. 每步预测一批 mask 位置的 token，按置信度**从高到低**保留最有把握的几个（低置信度重新变回 mask，进入下一轮）；
3. 重复 K 步（K 远小于序列长度），直到全部 unmask。

代表：**LLaDA**、**Dream 7B**、**MaskGIT/Muse** 思路的文本版。这套框架和 **BERT 的 MLM 训练是数学上兼容**的——LLaDA 甚至可以看作"多步、可控噪声比例"的 BERT。

### 2.2 Score-based Discrete Diffusion（离散得分扩散）

**Score Entropy Discrete Diffusion（SEDD）** 用连续时间马尔可夫链定义"token 之间的跳转"，训练目标是**得分熵损失**（score entropy loss），推理时用类似 Euler 求解器逐步降噪。数学更严谨，与图像扩散更同构，但工程实现更复杂，目前学界成果多、工业部署少。

### 2.3 两条路的对比

| 维度 | Masking Diffusion | Score-based（SEDD） |
| --- | --- | --- |
| 直觉 | "多步 BERT" | "连续时间离散扩散" |
| 训练目标 | 加权 MLM 交叉熵 | Score entropy loss |
| 工程成本 | 低（沿用 MLM 代码） | 高（求解器 + 特殊 loss） |
| 代表 | LLaDA、Dream、Mercury | SEDD、DiffuBERT |

## 三、代表工作速览（2024-2026）

| 模型 | 发布方 / 时间 | 亮点 |
| --- | --- | --- |
| **SEDD** | Stanford / 2024 | 首个在困惑度上追平自回归 GPT-2 的离散扩散模型 |
| **LLaDA-8B** | 人大 & 蚂蚁 / 2025 | 首个 8B 级"从零训"的扩散 LLM，指令跟随、少样本推理接近 LLaMA3-8B |
| **Dream 7B** | HKU / 2025 | 用 Qwen2.5 权重初始化，一次 forward 出多 token；在编辑任务上大幅领先 AR |
| **Mercury / Mercury Coder** | Inception Labs / 2025 | 首个"商业化"扩散 LLM，官方展示 1000+ tokens/s，主打代码生成 |
| **DiffuLLaMA / DiffuGPT** | 2025 | 从预训练 AR 模型"改造"为 DLM，几万步微调即可，为 DLM 大规模落地铺路 |
| **DiffuSeq / GENIE** | 早期探索 / 2023 | 端到端的文本扩散生成，规模较小 |

**趋势提示**：2026 年多家实验室在推**混合式**——AR 主干出草稿，扩散头做局部并行填空/refine；或反过来，扩散主干出骨架、AR 头收尾。

## 四、DLM vs AR 全维度对比

| 维度 | 自回归 LLM | 扩散 LLM |
| --- | --- | --- |
| 生成顺序 | 从左到右，严格因果 | 任意顺序、可并行 |
| 单次 forward 产出 | 1 token | 多 token（一次可预测数十~上百） |
| 上下文可见性 | 只能看左边 | 双向，全序列可见 |
| KV Cache | 有，且是核心优化 | **无标准 KV Cache**（每步注意力需重算），但可用 prefix cache |
| 长文本一致性 | 强 | 追赶中，容易"局部通顺、全局失衡" |
| 精确回答（问答/数学） | 强 | 目前弱于顶级 AR |
| 代码填洞 / 编辑 | 需要专门 FIM 目标 | **原生支持**，双向语境天然贴合 |
| 输出长度 | 无上限（EOS 结束） | **通常固定长度**（需预设或迭代扩展） |
| 训练目标 | Next-token CE，一步一目标 | Denoising，需多个 t，训练算力/token 更高 |
| 推理延迟 | 与生成长度线性相关 | 与**去噪步数 K**相关（K ≪ L） |
| 采样多样性 | 依赖 temperature/top-p | 天然由噪声调度提供 |

## 五、推理为何能快 10 倍以上？

关键在于**吞吐 vs 延迟的公式变了**：

- **AR 生成 L 个 token = L 次 forward**（每次都拖 GPU 显存带宽走一遍全部权重）。
- **DLM 生成 L 个 token = K 次 forward**（K 通常 8~64，K ≪ L）。

单次 forward 都要"过一遍权重"，但 DLM 一次能填多个位置，把**权重加载成本平摊掉**——这在**内存带宽受限**的推理场景（batch 小、序列长）优势最大。这也是为什么 Mercury 主打**代码补全**这种低延迟、高吞吐场景。

但要注意：

- 每步扩散**注意力是双向 + 全序列重算**，单步 FLOPs 高于 AR 单步；
- 优势主要在**H100/H200 等带宽受限硬件 + 中短序列 + 小 batch**；长上下文优势可能被 O(L²) 注意力吃掉。
- 与投机解码（[投机解码详解](/inference/speculative-decoding)）的关系：AR + 投机解码也是"一次多 token"的思路，DLM 可以看作把投机解码的"并行草稿"直接内建到训练目标里。

## 六、训练成本与挑战

- **每 token 训练算力更高**：DLM 训练时要采样不同 t（不同 mask 比例）、并预测所有 mask 位置的损失。LLaDA 论文报告在同等 token 数下训练 FLOPs 与 AR 相当，但**每步需要更多"有效梯度信号"**才能追平质量。
- **仍需大量 token**：LLaDA-8B 用了 2.3T token，与 LLaMA3-8B 同规模。DLM 并**没有降低预训练数据需求**。
- **loss 与最终指标错位**：训练目标是去噪重构 loss，与下游"通顺 / 正确"没有单调映射，评估调试更繁琐。
- **对齐与 RLHF 也在探索**：如何把 [RLHF/DPO](/finetuning/rlhf) 迁移到多步去噪目标上，是活跃研究方向；已有工作在 mask ratio 上做 policy gradient。

## 七、什么场景 DLM 已经/可能率先落地？

- ✅ **代码补全 / 填洞（FIM）**：双向语境 + 低延迟，Mercury Coder 已经在做。
- ✅ **格式约束生成**：JSON、SQL 这类"槽位式"输出，DLM 可以在骨架上并行填空，与[结构化输出](/engineering/structured-output)天然贴合。
- ✅ **文本编辑与改写**：给定原文和编辑意图，同一个模型一步 refine 完，不需要"再从头写一遍"。
- ⚠️ **长文本推理 / 复杂数学**：目前追不上顶级 AR，短期仍以 AR + [推理模型](/advanced/reasoning-models) 为主。
- ⚠️ **超长上下文**：O(L²) 双向注意力比 AR 单步更贵，需要与 [FlashAttention](/advanced/flash-attention) 或稀疏方案配合。
- ❌ **流式输出**：DLM 一轮 refine 会**改动已经"生成"的 token**，与"一 token 一 token 往外流"的用户体验不完全兼容；商业产品需要专门的"局部提交"策略。

## 八、与其它非 AR 方案的关系

| 方案 | 核心思想 | 与 DLM 关系 |
| --- | --- | --- |
| **投机解码**（详见[投机解码详解](/inference/speculative-decoding)） | 小模型出草稿、大模型批量验证 | 一次多 token 的另一种路径；DLM 内建，投机解码是"外挂" |
| **Medusa / EAGLE** | 多个 head 一次预测未来 N 个 token | 训练目标仍是 AR，只是并行化 |
| **状态空间模型**（Mamba，[SSM 页](/advanced/state-space-models)） | O(n) 递推 + 固定状态 | 仍是 AR，只是把注意力换成递推 |
| **BERT / MLM** | 双向掩码语言模型 | Masking DLM 是 MLM 的"多步、可调 mask ratio"扩展 |
| **非自回归翻译（NAT）** | 早期一次性并行翻译 | DLM 是 NAT 的"多步迭代版"，质量高得多 |

## 九、面试可用的公式与直觉

**训练目标（Masking DLM，简化）**：给定文本 $x_0$，采样时间步 $t \in [0, 1]$，按概率 $t$ 将每个 token 独立替换为 `[MASK]` 得到 $x_t$，最小化：

$$\mathcal{L} = \mathbb{E}_{t, x_0, x_t} \left[ \frac{1}{t} \sum_{i: x_t^i = \text{[MASK]}} -\log p_\theta(x_0^i \mid x_t) \right]$$

$\frac{1}{t}$ 是重要性加权（低噪声步权重大，因为更接近真值）。当 $t=1$（全 mask）时退化为标准 MLM。

**推理复杂度**（不含双向注意力自身开销）：

- AR：$O(L)$ 次 forward
- DLM：$O(K)$ 次 forward，$K = $ 去噪步数
- 常见 $L = 512, K = 32$：DLM 理论快 16 倍

## 高频追问

**Q：扩散模型不是用来生成图像的吗？搬到文本上难在哪？**
图像扩散加的是**连续高斯噪声**、有可微的 SDE/ODE；文本是**离散**的 token，没法直接加高斯噪声。主流解法：① Masking DLM——用"多步 mask/unmask"当作离散扩散（数学上是连续时间马尔可夫链的一种）；② Score-based DLM（SEDD）——用得分熵损失建模离散跳转。两者都要重新推导 loss，图像的那套代码几乎不能直接搬。

**Q：DLM 相比自回归的核心优势是什么？为什么号称快 10 倍？**
① **并行解码**：一次 forward 出多 token，把 GPU 显存带宽的"过权重"成本平摊；② **双向语境**：任意位置都能看到左右，适合填洞/编辑；③ **迭代 refine**：能回头修正，AR 一步错步步错。10× 加速在**中短序列、小 batch、带宽受限**场景（如代码补全）最明显；长上下文优势会被 O(L²) 双向注意力吃掉。

**Q：LLaDA 和 BERT 有什么本质区别？**
数学上是**同一族**——都是掩码预测。区别有三：① BERT 用**固定 15% mask 比例**，LLaDA 让 mask 比例 $t$ 在 $[0,1]$ 连续变化并加时间条件；② BERT 只做表示学习，LLaDA 学一个能从**全 mask 恢复出真句子**的生成器；③ BERT 单步预测，LLaDA 推理时**多轮迭代 unmask**。可以把 LLaDA 理解成"可控噪声比例、多步迭代的 BERT 生成器"。

**Q：DLM 没有 KV Cache 吗？还能怎么加速推理？**
标准 KV Cache 依赖单向 causal mask 才能"新 token 只看过去"。DLM 是双向注意力，每轮 refine 都要重算全序列的 K/V，**没有传统意义的 KV Cache**。但可以：① **Prefix cache**：如果 prompt 部分固定，可复用其 K/V；② **减少去噪步数** K：用更好的调度器（LLaDA 用 low-confidence remasking）；③ **稀疏化双向注意力**（滑窗、块稀疏）；④ **蒸馏成少步扩散**（类似 consistency models 在图像领域的思路）。

**Q：DLM 输出长度怎么控制？**
这是 DLM 的一个真实痛点。主流做法：① **固定长度**——预设 L，全序列去噪，模型学会用 pad/EOS 填充多余位置；② **块式扩展**——生成一个块（如 128 token）、判断是否结束、再续下一个块；③ **长度预测头**——先预测一个长度、再按长度扩散。这一点上 AR 的"生成到 EOS 就停"仍是最优雅的。

**Q：DLM 会不会取代自回归 LLM？**
短期不会。现有生态（KV Cache、投机解码、RLHF、评估基准、推理引擎）都是围绕 AR 建的；DLM 在质量、长上下文推理、指令跟随上仍在追赶。中期看，**混合架构**（AR 骨架 + 扩散并行填空 / 扩散骨架 + AR 收尾）比"纯 DLM 替代"更有可能落地。可以把 DLM 当作 [Mamba](/advanced/state-space-models)、[投机解码](/inference/speculative-decoding) 一起放在"非纯 AR 的推理加速路线"里理解。

**Q：怎么把预训练好的 AR 模型改造成 DLM？**
DiffuLLaMA / DiffuGPT 的做法：① 直接用 AR 模型的权重初始化 DLM Transformer；② 把 causal mask 换成双向；③ 加入 mask token 和时间 embedding；④ 用几百亿 token 做"扩散化微调"（continued training）。这条路径比"从头训 DLM"便宜一到两个量级，是 2026 年 DLM 快速铺开的关键工程手段。

**Q：DLM 训练成本一定比 AR 高吗？**
不是绝对。LLaDA 论文报告在**同等 token 预算**下 DLM 与 AR 训练 FLOPs 相当，因为 DLM 单步预测的是多个 mask 位置（信号更密）。但**收敛所需数据量**可能更大，因为每个样本要"多角度"看：不同的 mask 比例 $t$ 都要能重构。总账上目前 DLM 略贵、且训练稳定性不如 AR 成熟。

**Q：DLM 怎么对齐（RLHF/DPO）？**
是活跃研究方向。难点：AR 的 log-prob 是逐 token 分解、能直接算优势；DLM 的生成概率是**多步 denoise 的联合分布**，直接套 PPO/DPO 不成立。目前主流做法：① 只对最后一步做 policy gradient，把前面的 denoise 当环境；② 用 [DPO 变体](/finetuning/preference-optimization) 定义在"整段输出"上的偏好；③ 蒸馏一个 AR 教师的偏好到 DLM。见 [RLHF/DPO 对齐](/finetuning/rlhf) 页面理解 AR 侧对齐基础。
