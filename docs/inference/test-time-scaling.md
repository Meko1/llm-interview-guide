# 推理时算力扩展（Test-Time Compute Scaling）

> 传统预训练 scaling law 靠"训练时堆参数和数据"提能力；推理时算力扩展开辟了**第二条 scaling 曲线**——同一个模型，推理时投入更多算力（更长思考、更多采样、结构化搜索），准确率就能显著提升。它和 [推理模型](/advanced/reasoning-models)（把 test-time scaling 内化到模型里）互补，而本页聚焦**服务侧、可加在任何模型之上的推理时增强技术**：Self-Consistency、Best-of-N、Tree of Thoughts、MCTS、PRM-guided beam、Budget Forcing、Snell 的 compute-optimal 结论。前置阅读：[推理模型与慢思考](/advanced/reasoning-models)、[CoT 全家桶](/prompt/cot-reasoning)、[KV Cache 深度专题](/inference/kv-cache)、[投机解码详解](/inference/speculative-decoding)。

## 面试先背这几句话

- **两条 scaling 曲线**：训练时（更大模型 / 更多数据）、推理时（更长思考 / 更多采样 / 更结构化搜索）。**Snell et al. 2024（DeepMind）**：在给定 FLOPs 预算下，**推理时算力扩展有时比多训一倍的模型还划算**，尤其是简单-中等难度任务。
- **三条推理时路线**：① **垂直深化**（同一条推理链变长，long CoT / s1 Budget Forcing）；② **水平并行**（采样 N 条独立推理链，Self-Consistency / Best-of-N / Weighted voting）；③ **树/图搜索**（结构化探索，ToT / GoT / MCTS / LATS / rStar-Math）。
- **关键的一根火柴**：**有没有 verifier**。可自动验证的领域（数学、代码、部分事实性问答）能用 ORM/PRM 精准筛选 → 推理时扩展效益极高；开放域生成没有可靠 verifier → 推理时扩展只能靠 RM 打分，效益打折。
- **代表工作**：Self-Consistency（Wang et al. 2022）、ToT（Yao et al. 2023）、GoT、LATS、Math-Shepherd（Wang et al. 2024）、rStar-Math（2024）、s1（2025）、Snell 2024 compute-optimal、DeepSeek-R1（把 test-time scaling 内建到模型）。

## 一、为什么"多花推理时算力"能换来更强？

三个不同的直觉：

1. **采样多样性 → 覆盖到正确答案**：单次贪心解码有可能落在错误的路径上；采样多条推理链，正确路径至少出现在少数样本里，投票或验证就能选出来。
2. **explore-then-verify**：生成候选（explore）比校验候选（verify）本质上更难。给模型多次机会 explore、再让 verifier 挑选，能突破"一次生成"的能力上限。
3. **搜索结构 = 显式的规划**：ToT / MCTS 让模型在推理空间里做"局部展开-评估-回溯"，把内在的隐式规划暴露为可控的搜索过程，比线性 CoT 更能处理组合优化、多步计划类任务。

## 二、三条主线全景

### 2.1 垂直深化：同一条推理链变长

- **long CoT（默认）**：让模型多想几步。适合数学、逻辑、编程。
- **Budget Forcing（s1, 2025）**：训练时用 1K 精选样本 SFT；**推理时强制"再想想"**——遇到 `</think>` 就替换成"wait"让模型继续思考；生成到目标 budget 才允许出答案。仅 1K 样本 SFT + budget forcing，就在 AIME 追上 R1-Preview。是"最省"的推理时扩展方案。
- **自适应思考预算**：新一代推理模型通常会按题目难度调节思考深度，简单题少想、难题多想；服务侧也可以用难度分类器或置信度阈值做类似的预算控制。

### 2.2 水平并行：多条独立推理链

| 方法 | 汇总规则 | 说明 |
| --- | --- | --- |
| **Self-Consistency**（Wang 2022） | 多数投票 | 采样 K 条 CoT，取答案众数。数学、逻辑最实用 |
| **Best-of-N**（BoN） | Verifier / RM 选最高分 | 需要 verifier；可验证任务效益爆棚 |
| **Weighted Voting** | RM 打分加权投票 | Self-Consistency 的加权版，抗多数错票 |
| **Universal Self-Consistency** | LLM-as-judge 选最一致回答 | 无 verifier 时的兜底方案，适合开放域 |
| **Rejection Sampling**（离线） | 采样 + 验证 → 训练集 | 把推理时扩展的收益**转移到训练** |

**关键公式（Self-Consistency）**：若真答案概率 $p > 0.5$，投票 K 次的正确率约 $1 - \Phi(-\sqrt{K}(2p-1)/\sqrt{4p(1-p)})$，K↑ 单调收敛到 1。**但 $p < 0.5$ 时 K 越大越糟**——这是 Self-Consistency 的边界条件。

### 2.3 树/图搜索：结构化探索

| 方法 | 结构 | 核心思想 |
| --- | --- | --- |
| **Tree of Thoughts（ToT, Yao 2023）** | 树 | 每步生成多个候选"念头"，用 LLM 自评打分选 top-k 展开，可 BFS/DFS |
| **Graph of Thoughts（GoT）** | DAG | 允许"合并、复用中间思考"，节点可回收 |
| **LATS（Language Agent Tree Search）** | 树 + MCTS | ToT 用 MCTS 探索，配合外部反馈（工具/环境）打分 |
| **RAP（Reasoning as Planning）** | 树 + MCTS + World Model | 用 LLM 当 world model 模拟未来，MCTS 规划 |
| **rStar / rStar-Math**（2024） | MCTS + PRM | MCTS 展开推理树，PRM 打分剪枝，最终蒸馏成小模型 |
| **Math-Shepherd + Step-Beam**（2024） | Beam Search + PRM | 保留 top-k step，PRM 一步一步引导 beam |

**MCTS 的四步循环**（Selection → Expansion → Simulation → Backpropagation）在 LLM 推理里的适配：
- **Selection**：UCT 或 PRM 分数选下一个要展开的节点；
- **Expansion**：LLM 生成 k 个候选下一步；
- **Simulation**：让 LLM 自完成到叶节点，或用 PRM 直接打分；
- **Backprop**：把叶子分数回传更新父节点。

代价：每步都要 LLM forward，成本可以到"单条 CoT"的 20-100×，仅适合关键场景（竞赛数学、代码 debug）。

## 三、Verifier / Reward Model：所有方法的胜负手

**结论先摆出**：**推理时扩展的天花板 = verifier 的准确率上限**。

| Verifier 类型 | 特点 | 代表 |
| --- | --- | --- |
| **规则 / 自动化**（数学答案、代码 exec） | 100% 准确，最理想 | GSM8K、MATH、HumanEval |
| **ORM（Outcome Reward Model）** | 只看最终答案对不对，训练便宜 | RLHF 常见 RM |
| **PRM（Process Reward Model）** | 给每一步打分，信号密集 | Math-Shepherd、Skywork-PRM、Qwen2.5-Math-PRM |
| **LLM-as-Judge** | 通用但不精确，适合开放域 | GPT-4 judge、Prometheus |
| **Generative Verifier**（GenRM） | 让模型"生成一段推理再给结论"，比二分类更强 | GenRM (Zhang 2024) |

**PRM > ORM**：在 MATH benchmark 上，同样 32 条采样，PRM-guided Beam 比 ORM-BoN 高 5-8 分。但 PRM 需要**步骤级标注**（人工或 Math-Shepherd 自动化标注），训练成本高。

**PRM 训练的自动化技巧**：Math-Shepherd 用 **rollout 概率**估计每步价值——从当前步骤 rollout k 次，rollout 通向正确答案的比例作为该步骤的软标签。这是 2024 后 PRM 训练的主流做法。

## 四、Snell 2024：Compute-Optimal 结论

**"Scaling LLM Test-Time Compute Optimally Can Be More Effective Than Scaling Model Parameters"**（Snell et al., DeepMind, 2024）系统对比了三类推理时策略在 MATH 上的效率：

1. Best-of-N with ORM
2. Beam search with PRM
3. Sequential revision（模型自己迭代改答案）

**核心结论**：
- **简单题**：**sequential revision** 最好——一次输出候选，然后让模型逐步修正；
- **中等题**：**Beam search + PRM** 效率最高；
- **难题**：**Best-of-N + PRM** 更稳；
- **compute-optimal 策略**：先判断题目难度，再动态选择策略——总体在 MATH 上给定 FLOPs 下可**比多训一倍参数的模型还强**。

**面试意义**：这篇论文把"推理时扩展 vs 预训练扩展"的经济性对比讲清楚了——不是"推理时永远划算"，而是"**在给定 FLOPs 预算下，某些任务/难度区间，推理时扩展效率更高**"。

## 五、与推理模型的关系

**长 CoT 推理模型（o1 / R1 / QwQ）本质上是把 test-time scaling 内建到模型里**：
- 传统模型 + 外挂 test-time scaling（如 Self-Consistency + BoN）→ 需要工程侧显式管理采样、验证、投票；
- 推理模型（内建 long CoT）→ 模型自己"多想一会儿"，一次 forward 就完成同等效果，工程侧只要给足 output token 预算。

哪个更好取决于场景：
- **单请求延迟敏感**（如聊天）→ 推理模型的自适应终止更优；
- **可离线并行**（如 batch 评估）→ 传统模型 + Self-Consistency/BoN 常更省，因为可以 batch 采样、并行验证；
- **需要可解释、可干预**（如医疗、法律）→ 显式的 ToT/MCTS 更适合，能看到搜索树、能人工介入某一步。

## 六、组合与前沿

| 组合 | 场景 |
| --- | --- |
| **推理模型 + Self-Consistency** | R1 + 采样 32 条 CoT + 投票，AIME 从 79 → 85 |
| **推理模型 + Best-of-N + PRM** | 高精度数学赛题 |
| **s1 Budget Forcing + LLM-as-Judge** | 开放域推理，无 verifier |
| **rStar-Math：MCTS + PRM + 蒸馏** | 用推理时扩展**生成训练数据**，蒸馏成小模型（把推理时收益转训练时） |
| **推理时扩展 + 投机解码**（详见 [投机解码](/inference/speculative-decoding)） | 生成加速与采样质量结合，工程实现有细节 |

**2025-2026 的合流方向**：
- **Reasoning + Agent**：推理模型和工具增强正在合流，模型可以边思考、边搜索、边运行代码、再把观察结果接回推理链；
- **Long-Horizon Test-Time Compute**：跨请求维持推理状态（类似 [Agent 记忆](/agent/agent-memory)），几小时到几天的 [深度研究 Agent](/agent/deep-research) 任务；
- **Reasoning-as-Data-Engine**：用推理时扩展（MCTS + PRM）生成合成训练数据（详见 [合成数据](/finetuning/synthetic-data)），实现"推理时算力→训练时收益"的转换。

## 七、工程侧代价与优化

**采样 K 条 = K 倍推理成本**——但可以通过工程手段摊薄：

- **Prefix Caching**（[KV Cache](/inference/kv-cache)）：多条采样共享 prompt 的 KV，K 次采样只 Prefill 1 次；
- **Batch 采样**：K 条采样在同一个 batch 里跑，充分利用 GPU；
- **Speculative Decoding**：小模型出草稿、大模型验证，可与 BoN 组合；
- **Early Stopping**：Self-Consistency 边采样边统计，答案投票已经"稳"了就提前停；
- **动态 K**：简单题 K=1，难题 K=32，用小模型或分类器预判难度。

**吞吐 vs 延迟**：
- 单请求维度：BoN K=32 会显著放大 GPU 时间、输出 token 和排队压力；如果串行采样，首字延迟也会近似放大。
- 系统吞吐维度：K 条采样可以塞进同一个 batch，摊薄权重加载成本，但会挤占 goodput，必须和普通在线请求隔离预算。

## 高频追问

**Q：Self-Consistency 什么时候会失效？**
两种情况：① **单次正确概率 $p < 0.5$**——投票会把"多数错误"扶正，K 越大越糟；② **答案空间连续/开放**（写作、翻译）——不同采样答案不同但没有"众数"可投。前者的解法是先用 few-shot / SFT / 推理模型把 $p$ 拉过 0.5；后者的解法是换 Best-of-N + RM 或 Universal Self-Consistency（LLM-judge）。

**Q：Best-of-N 和 Self-Consistency 的选择依据？**
看**能不能自动验证**：
- 数学、代码、结构化输出（能自动判对错）→ **Best-of-N + verifier** 最优；
- 数学但 answer parser 复杂 → Self-Consistency 投票通常够用，工程简单；
- 开放域生成 → 只能用 RM 打分的 Best-of-N，效益打折。
BoN 的天花板是 verifier 准确率，SC 的天花板是"多数正确率 > 0.5"这个前提。

**Q：Tree of Thoughts 相比 CoT 提升在哪？什么时候值得用？**
CoT 是"一路走到黑"，ToT 是"多条路径 + 自评 + 回溯"。ToT 提升在**需要探索多方案再决策**的任务：Game of 24、Creative Writing 需要局部展开评估的场景。代价是 LLM 调用数放大 10-100 倍。**日常问答、常规推理，CoT 就够，ToT 是过度设计**。真值得上 ToT/MCTS 的是竞赛数学、复杂代码 debug、长周期规划。

**Q：PRM 相比 ORM 到底强多少？训练 PRM 有什么难点？**
在 MATH 上同 K=32 采样，PRM-guided 通常比 ORM-BoN 高 3-8 分。因为 PRM 在**中间步骤**就能剪掉错误分支，避免"错答案被完整生成后才被扔掉"。难点：**步骤级标注**贵。Math-Shepherd 用 rollout 概率自动化：从某步 rollout k 次，通向正确终点的比例当作该步的软标签——这是把 ORM 的 outcome 信号"回填"成 process 信号。

**Q：Budget Forcing（s1）为什么用几千条数据就能追上 R1？**
两个原因：① SFT 的 1K 精选样本已经激活了 base 模型的推理能力（LIMA 效应）；② **推理时的 budget forcing 是关键放大器**——在生成结束标记时替换为"wait"让模型继续思考，等价于强制"再检查一遍"。s1 不训练模型学"多想"，而是**推理时逼它多想**——用工程手段撬动模型已有的能力。这是 2025 年最"性价比"的 test-time scaling recipe。

**Q：推理模型（R1/o1）+ Self-Consistency 有意义吗？**
有。虽然推理模型内建了 test-time scaling，但**采样多条 R1 输出再投票**仍能显著提升——因为 R1 单次采样也不是 100% 正确（AIME 上 R1 单次约 79%，K=32 投票能到 85%+）。工程上要注意：R1 输出长（每条 5-30K token），K=32 的成本非常高，一般 K=8 就够。

**Q：Snell 2024 说"推理时扩展有时比多训一倍参数还强"，怎么理解这个结论？**
不是"推理时扩展永远划算"，而是**在给定 FLOPs 预算下**：
- 简单-中等难度：推理时扩展效率更高（一个小模型 + 100× 推理时算力 > 大一倍的模型）；
- 难题：预训练大模型仍然更强（推理时扩展也救不回能力上限）。
所以 compute-optimal 策略是"**先按难度分流**"：简单题小模型 + 推理时扩展；难题上大模型。这也是 2025 生产系统里越来越常见的**router 架构**的理论基础。

**Q：MCTS 用在 LLM 推理里的最大工程难点？**
① **单步展开成本高**：每个节点都要 LLM forward，一次 MCTS 少说几百次调用；② **Simulation 步的估值不准**——用 LLM 自评或 PRM 打分都是近似，噪声大；③ **搜索树可能失控**：分支因子高、深度不定，需要精细的 UCT/温度调整；④ **中间状态的表示**：不像围棋是明确棋盘，LLM 推理的"状态"是可变长文本，缓存和比较都麻烦。所以 MCTS + LLM 目前只在数学竞赛、代码 debug、Agent 规划这类高价值场景落地，不是日常方案。

**Q：为什么"离线"用推理时扩展生成训练数据这么火？（rStar-Math / R1-Distill 思路）**
把推理时的"高精度但高成本"直接**摊到训练里**：
- 用 MCTS + PRM 花很多推理算力，生成高质量推理轨迹；
- 用这些轨迹 SFT 小模型；
- 小模型上线后**单次推理就能达到接近"MCTS + PRM"的效果**，推理成本回到普通模型水平。
本质是"**推理时算力 → 训练时收益 → 上线时省算力**"的一次性摊销。rStar-Math 用这条路径让 7B 模型追平 o1-mini，是 2024 后"推理时扩展"最有商业价值的落地范式。

**Q：Self-Consistency 采样 K 条，工程上怎么摊薄成本？**
四个技巧：① **Prefix Caching**：K 条共享 prompt 的 KV Prefill 一次即可（[KV Cache 页](/inference/kv-cache)）；② **同 batch 并行采样**：K 条塞进同一个 batch，摊薄权重加载；③ **Early Stopping**：边采样边投票，达到置信阈值就停；④ **动态 K**：分类器/小模型预判题目难度，简单题 K=1、难题 K=32。实际成本收益强依赖模型、长度分布、prefix 命中率和 verifier 质量；面试里要说“先压测再定 K”，不要承诺固定倍数。

**Q：Self-Consistency wrapper 手撕时要写哪些点？**
最小版本要写四件事：多次采样、答案归一化、多数投票、领先答案无法被反超时提前停止。模型调用要抽象成 `sample_fn`，不要和投票逻辑耦合；开放域任务不要强行字符串投票。参考实现见 [手撕代码题解集](/interview/coding-problems)。
