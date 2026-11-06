---
title: B 站学习路线：从视频到能力证据
description: 将视频发现入口连接到官方课程、论文与实现，区分原作者、搬运和待核候选，以练习产物而非观看进度证明能力。
level: L2
roles:
  - 在校生
  - 应用开发
  - 算法研究
classification: inferred
---
# B 站学习路线：从视频到能力证据

视频是理解的入口，**代码、实验记录与失败分析才是能力证据**。本页不按播放量评“最好”，也不把看完课程当作掌握。

::: warning 核验边界 · 2026-11-04
此前 2026-11-04 记录称核对了 9 条视频的 BV、UP 主、简介及分 P 元数据，并读取部分原课/仓库 README；这是旧记录，不冒充 2026-11-05 再次核验。本轮未读取这些视频页面、完整字幕或观看内容，保留 BV 与旧定位供核对；只取得部分官方仓库的网页检索摘录。字幕、配音、授权与演示正确性仍待核，课程不能视作人工技术认证。
:::

## 先选路线，不先囤课程

| 你的目标 | 建议起点 | 要留下的证据 |
| --- | --- | --- |
| L0：建立模型直觉 | 李宏毅课程中与当前问题相关的一讲，再读站内基础页 | 用自己的话解释模型、检索、工具各负责什么，不先租 GPU |
| L1：做应用 | 李宏毅 AI Agent / RAG 作业入口，配合应用练习手册 | 一个能回放失败样例的 RAG 或 Agent 项目，而不是只有聊天界面 |
| L2：工程落地 | Tokenizer 实现、最小训练闭环；按岗位补性能实验 | 固定配置、正确性检查、前后对照与限制说明 |
| L3：算法 / Infra | CS336 指定作业，回看原课与论文 | 可复现实验、误差分析、性能证据，不照抄解答 |
| L4：前沿研究 | 从一手资料阅读地图选择具体问题 | 论文假设、未解决问题与反例；本清单不承诺覆盖全部前沿 |

相关入口：[能力定位](/capability-map)、[应用练习手册](/beginner/llm-first-practice-handbook)、[一手资料阅读地图](/advanced/primary-source-reading)。

## 五组优先学习候选

以下“已关联/已核对/已读取”均指此前记录，未重新打开的来源本轮按 linked_only 登记，**不表示搬运授权、翻译准确性或全部技术结论已核实**。同一课程两个译版可按语言需求选一个，不把重复观看当作新能力证据。

### 1. 李沐：Transformer 论文逐段精读

- [B 站视频 · 跟李沐学AI · 87 分 05 秒](https://www.bilibili.com/video/BV1pu411o7BE/)。
- **来源状态：作者项目交叉关联。** 视频简介链接 [mli/paper-reading](https://github.com/mli/paper-reading)，该项目 README 也列出同一 BV；不是仅凭 UP 主名称推断身份。
- **学习顺序：**先读 [Transformer](/basics/transformer) 与 [Attention](/basics/attention)，再围绕一个不懂的问题看视频，最后回到 [原始论文](https://arxiv.org/abs/1706.03762)。
- **自测产物：**画出 Q/K/V 的张量形状；写出 padding 与 causal mask 的区别；说明为什么 decoder 训练时不能看未来 token。
- **项目判断：**机制、图解和自测已有覆盖，缺的是具体视频入口；不需要再新增一篇重复的 Transformer 综述。

### 2. Karpathy：手写 GPT Tokenizer

- [中文字幕版 · 陨石少校 · 133 分 35 秒](https://www.bilibili.com/video/BV1opWYezEFK/)。
- [中英字幕版 · Web3天空之城 · 133 分 35 秒](https://www.bilibili.com/video/BV1wt421h7Cx/)。
- **来源状态：第三方译版候选。** 标题与时长已核对；没有确认字幕完整性及授权。原作者材料以 [Karpathy minbpe](https://github.com/karpathy/minbpe) 为准，已读取 README 中的训练、编码、解码及测试说明。
- **前置：**Python、UTF-8 字节与 [Tokenizer 基础](/basics/tokenizer)。无需先购买 GPU。
- **自测产物：**小语料的 merge 表；编码按已训练的 merge 顺序处理的说明；中文、emoji、组合字符与特殊 token 的往返测试；保存/加载后的结果对照。
- **项目判断：**已有算法概览，尚缺集中、可运行的字节级 BPE 练习与边界测试。重点是查错，而非再记一遍算法名称。

### 3. 袁朝发：从零手写小语言模型

- [B 站视频 · 袁朝发 · 56 分 52 秒](https://www.bilibili.com/video/BV1qWwke5E3K/)。
- **来源状态：作者项目交叉关联。** 视频简介指向 [LLMs-Zero-to-Hero](https://github.com/bbruceyuan/LLMs-Zero-to-Hero)，项目 README 链接同一 B 站账号。已读取 README，未验证代码运行结果；简介含推广信息，不将其纳入学习建议。
- **前置：**[从 logits 到损失](/basics/logits-loss)、[mask 与 padding](/basics/masks-padding)、[反向传播与优化](/basics/backpropagation-optimization)。
- **自测产物：**固定代码版本、数据划分与随机种子；先在小样本验证训练逻辑，再记录独立验证集 loss、生成样例与训练状态保存/恢复实验。
- **项目判断：**已有应用实践与训练概览，但未发现集中组织的“从小模型到可恢复训练”的验收练习。不能把短视频的“一小时学会”当成学习时长保证。

### 4. Stanford CS336：选作业，不追整套合集

- [英文原声 / 中英字幕候选 · 常青藤名校课](https://www.bilibili.com/video/BV1fvhK6hExg/)。
- [中文配音候选 · 常青藤名校课](https://www.bilibili.com/video/BV11LEA6eEuj/)。
- **版本状态：待确认。** 两条上传标题声称“2026 最新版”；此前关联 [Stanford Spring 2025 归档](https://cs336.stanford.edu/spring2025/) 与 [Assignment 1 仓库](https://github.com/stanford-cs336/assignment1-basics)，这些页面及 [CHANGELOG](https://github.com/stanford-cs336/assignment1-basics/blob/main/CHANGELOG.md)本轮未取得可核正文，不补造版本或发布日期。main会更新，先固定选定tag/commit，使用同版本handout、adapters和测试，不能据上传日期认定学年。
- **合集注意：**分 P 同时包含重制版与其他版本；总时长不是一套课程的净时长。下面的分 P 编号是本轮元数据快照，更新后应按标题重新定位。

| 目标 | B 站分 P 候选 | 原课交叉依据 | 建议验收 |
| --- | --- | --- | --- |
| 分词与训练基础 | P1 Overview / Tokenization；P2 PyTorch；P3 Architectures | 2025 A1 Basics | 自己实现核心组件，并连接官方 adapters 与测试；先 CPU 查正确性 |
| GPU 与性能 | P5 GPUs / TPUs；P6 Kernels / Triton / XLA | 2025 A2 Systems | 正确性基线、benchmark 配置、trace 与优化前后对照 |
| 数据与评估 | P12 Evaluation；P13–14 Data | 2025 A4 Data，课程日程 | 数据去重方案、留出集、污染风险说明与消融 |
| 后训练 | P15 Mid/Post-Training；P16 RLVR | 2025 A5 Alignment and Reasoning RL | 奖励定义、训练/测试隔离、失败样例与复现边界 |

这里是**学习目标映射**，不是确认 B 站每一分 P 与 2025 原课逐分钟一致。L1 应用岗位不必完整实现所有系统作业；L2/L3 按目标选一项做深。

### 5. 李宏毅：生成式 AI 时代下的机器学习

- [2025 春季合集候选 · 小尹不吱声](https://www.bilibili.com/video/BV1EJM96BESq/)。
- **来源状态：第三方合集，课程主题交叉匹配。** 已核对分 P 标题与 [李宏毅官方 2025 Spring 课程页](https://speech.ee.ntu.edu.tw/~hylee/ml/2025-spring.php) 的相关主题 / 作业；没有将搬运 UP 主视为课程官方账号。
- 官方课程页有课件、原视频与作业入口。优先使用官方材料核对术语；B 站只作中文观看入口。

| 你要解决的问题 | 本轮合集定位 | 站内对应内容 | 要补的证据 |
| --- | --- | --- | --- |
| RAG 与 Agent 怎样评估 | P2 HW1；P3 AI Agent；P4 HW2 | [RAG 基础](/rag/rag-basics)、[Agent 评估](/agent/agent-evaluation) | 固定任务集、失败轨迹与重复试验，不能只展示一次成功 |
| 微调为什么遗忘 | P12 Post-Training 与遗忘；P13 HW6 | [微调](/finetuning/finetuning)、[领域模型](/finetuning/domain-expert-model) | 领域提升与通用能力保留的同配置对照 |
| 模型内部机制 | P5 模型内部；P6 HW3 | [机制可解释性](/advanced/interpretability) | 区分观察与干预，不把激活相关性直接当因果证明 |
| 模型编辑与合并 | 按合集后续分 P 标题定位；以官方 HW8 / HW9 为准 | [模型合并](/finetuning/model-merging) | 模型编辑尚缺独立专题；合并已有文章，不重复铺概念 |

## 两条待深核候选：暂不作为主教材

| 候选 | 已核实 | 未核实 / 下一步 |
| --- | --- | --- |
| [GPU Mode：NVIDIA 性能分析 Profiling · Mindofuture · 127 分 16 秒](https://www.bilibili.com/video/BV1x2d5YPE6x/) | BV、UP 主、标题与时长；简介为空 | 原讲次、讲者、版本与字幕待交叉确认；先用 CS336 A2 原始材料确定练习目标 |
| [vLLM 参数配置与性能调优 · 五道口纳什 · 22 分 22 秒](https://www.bilibili.com/video/BV1QnSFBkEZU/) | 详情简介给出 [notebook](https://github.com/wdkns/modern_genai_bilibili/blob/main/agentic_rl/inference/vllm_sglang.ipynb) 与 [verl 调优文档](https://verl.readthedocs.io/en/latest/perf/perf_tuning.html#rollout-generation-tuning) | 配套 notebook 未运行，软件版本与实验条件待核实；不能迁移视频中的性能数字作为生产结论 |

性能路线已有 [推理优化](/inference/inference-optimization)、[压测协议](/inference/inference-benchmark)、[SLO 与 goodput](/inference/slo-goodput)；缺的是从 trace 到瓶颈、到改动、到复测的完整练习，而不是这些名词。

## 项目该补什么：六项具体任务

下面保留此前仓库检索的**补充计划**，本轮未重扫其他作者正在编辑的全站内容，缺口状态可能变化；不是已经完成的新教材。

| 优先级 | 缺口类型 | 具体补充 | 可检查的完成条件 |
| --- | --- | --- | --- |
| P0 · L1/L2 | 已有概念，缺练习 | 字节级 BPE 实现与 Unicode 边界 | merge 顺序、特殊 token 策略、往返与持久化检查，附运行方式 |
| P0 · L2/L3 | 已提及，缺推导 | 变长序列的 loss / 梯度累积 | 对照有效目标 token 数与 microbatch 归一化；与完整 batch 的梯度对照，写清 mask 与随机层条件 |
| P1 · L2/L3 | 已有状态清单，缺验收闭环 | 最小训练与中断恢复 | 代码/数据版本、验证集、完整状态、恢复后下一步与连续训练的对照及容差 |
| P1 · L2/L3 | 已有原理，缺实验 | profiler 驱动性能诊断 | 预热、同步、测量区间与 profiler 开销说明；一份 trace 支撑瓶颈判断，复测质量与 SLO |
| P1 · L1/L2 | 已有遗忘机制，缺实验 | 微调收益与能力保留评估 | 同一基座/数据预算/模板，领域与通用留出集，失败样例与回滚条件 |
| P2 · L3/L4 | 未发现独立专题 | 模型编辑及失败边界 | 与 RAG / 微调的适用边界；编辑成功、局部性、泛化、多次编辑与失效案例 |

P0/P1 是本项目的编辑建议，不是通用岗位标准。模型编辑应先读官方课件和原论文，再决定范围；不能仅从视频标题补出一篇貌似深入的文章。

给 Tokenizer 候选一个具体失败验收：[minbpe 官方仓库](https://github.com/karpathy/minbpe/tree/master)本轮检索摘录确认它是 UTF-8 字节级 BPE 教学实现，不证明译版准确或模型 tokenizer 完全兼容。保存/加载后编码应一致；对合法字符串要求 decode(encode(s))=s，但启用规范化后应比较 normalize(s)，不能仍承诺原字节无损。`é` 与 `e` 加组合重音看起来相同，UTF-8 字节和 token 序列可能不同。特殊 token 的允许/拒绝策略也需独立验收，不能从普通文本往返推导出安全性。

给训练候选一个可复算错误：两份 microbatch 分别含 2 与 6 个有效目标 token，均值 loss 为 1 与 3；整批 token 平均应是 (2×1+6×3)/8=2.5，直接平均两份均值会得到 2。梯度累积同样要按有效 token 数加权；需同时固定参数、mask、归约和随机层条件，不能仅凭 loss 下降宣称训练正确。

<details>
<summary>同一个 Tokenizer 视频，L1/L2/L3 应留下什么不同证据？</summary>

**L1**：解释中文/emoji 为什么不能用字符数估算 token 预算，并展示往返边界。**L2**：固定 tokenizer 配置与特殊 token 策略，比较缓存、持久化和输入分块的结果，说明失败定位。**L3**：比较合并规则、预分词与规范化的独立影响，用留出语料测压缩率和吞吐；禁止拿不同版本作业的测试通过数比较能力。

</details>

替代路径：译版来源不明时，直接用原作者 README 和选定版本作业；没有 GPU 时先做字节级分词、mask 与小张量正确性，不购买硬件来替代问题定义。官方课程页本轮不可读的部分继续待核，不由视频标题补出教学结论。

## 怎样把一段视频变成面试证据

1. **先写问题：**这次要理解哪一个机制或排查哪一个失败？只选相关一讲。
2. **找到原出处：**记录视频 BV、原课 / 论文、代码 commit、软件与数据版本；译版术语对照原材料。
3. **独立做最小实验：**先验证正确性，再测性能；不要把看懂代码和复制运行当成独立实现。
4. **保存对照：**配置、原始结果、误差 / 失败样例、解释与未解决问题分别记录。没有实测就标“计划”，不编造结果。
5. **练习口述：**解释动机、假设、失败、取舍，以及“什么证据会推翻我的判断”。讲清责任边界，不把课程实验包装成生产经验。

建议记录模板：

| 字段 | 你来填写 |
| --- | --- |
| 问题与目标层级 | 本次要回答什么，不是“学完整个大模型” |
| 原出处 | BV、讲次 / 分 P、论文 / 原课、代码版本 |
| 实验条件 | 数据划分、模型、随机种子、软件、硬件、预算 |
| 正确性与基线 | 检查哪些性质，对照什么结果 |
| 结果与失败 | 原始记录、偏差、反例、没有解决的问题 |
| 面试口述 | 设计动机 → 验证 → 失败 → 取舍 → 适用边界 |

## 为什么不收“大而全”合集

标题中的“唯一”“最强”“召回率 99%”不是证据；重复合集也不是更完整的课程。RAG、Agent、LoRA、KV Cache 与模型合并在站内已有覆盖，本轮不为了增加篇数重复铺设。只有能关联原材料、对应具体缺口、并能说明验收条件的资源，才值得继续深核。

外链与分 P 会变化；本页保留核验日期及待核状态。完整字幕不可取得不等于视频没有字幕，更不等于视频质量差。
