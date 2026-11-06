---
title: 大模型学习路线
description: 按目标任务、前置自测和项目证据选择大模型学习路线；区分应用、工程与研究分支，给出可验收的阶段产出，不承诺转型周期或用培训等级代替能力。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 大模型学习路线

> **先选任务，再补能力，最后留下证据。** 这不是所有人必须读完的课程顺序，也不是招聘保证。工作背景用于建议起点，不用于推断你已经掌握某项能力；可先用 [能力定位](/capability-map) 查看前置与路线。

## 按背景选择你的起点

| 你的背景 | 先做什么自测 | 首选分支 | 何时补回基础 |
| --- | --- | --- | --- |
| 后端/Java 工程师 | 解释异步流、取消、权限和未知提交，展示已有代码 | 应用 → RAG 或工具工作流 → 服务治理 | 不能解释 token、概率和证据误用时补阶段一 |
| 应届/在校生 | 用 Python 读数据、写测试断言、解释训练/验证划分 | 一个小闭环项目，同时补理论 | 不必等待读完整站才开始；错误揭示缺口后补读 |
| 算法/研究背景 | 复算张量形状/损失，解释泄漏、方差与基线 | 训练或推理实验 + 工程恢复 | 不熟悉 API、权限或分布式失败时补阶段二/五 |
| 产品/零基础 | 判断输出有无证据、识别隐私与副作用风险 | [入门](/beginner/getting-started) → 无写权限的小任务 | 自己实现前补编程；只做方案评审可先侧重验收 |

不提供“几个月必能转型”的时间承诺。用一周小试记录实际投入、阻塞和完成的产物，再安排下一阶段；学习时间、调用费用和硬件需求分别预算。没有付费 API 或 GPU 时，可以用录制/构造响应验证应用逻辑，但应标明**模拟链路**，不把它写成模型质量或硬件实测。

## 你需要补什么？

如果你已有编程/工程基础（尤其是后端工程师），转型大模型主要补三块：

1. **AI 基础理论**：神经网络、Transformer、Attention、Embedding。
2. **Python 与 AI 生态**：Python、NumPy/Pandas、HuggingFace、PyTorch（用到再深入）。
3. **大模型特有范式**：Prompt Engineering、RAG、Agent、微调、推理部署。

> 工程经验可以复用，但大模型输出的随机性、证据不足、分布变化和评估误差需要新的验证方式。不要只把普通 API 封装套在模型上，也不要因模型“不确定”放弃确定性的权限和业务约束。

## 阶段一：地基（理论 + 调通 API）

**目标**：理解 token 如何进入模型、下一 token 分布如何生成回答；能接入一种模型接口并知道自己未验证什么。

- 神经网络与 Transformer 基础：看 [Transformer 架构](/basics/transformer)、[Attention 与变体](/basics/attention)、[位置编码](/basics/position-encoding)、[Tokenizer](/basics/tokenizer)。
- 需要补 Python 张量/自动微分时，可读 [PyTorch Learn the Basics](https://docs.pytorch.org/tutorials/beginner/basics/intro.html)。它假设已有 Python 与深度学习基础，不是零前置的 LLM 训练课。
- **产出**：记录一个输入的 token、角色消息和输出；画出因果可见范围；分别说明截断、拒答、超时和空返回。SDK/模型版本与请求配置须入实验记录，密钥不得进入文档或浏览器前端。

## 阶段二：应用（Prompt + 框架 + 第一个项目）

**目标**：把模型返回变成有校验、错误处理与版本边界的应用结果；框架是可选实现，不是本阶段能力证书。

- [Prompt 工程](/prompt/prompt-engineering)：Zero/Few-shot、CoT、ReAct、结构化输出、注入防护。
- [LangChain 与应用开发框架](/engineering/langchain)、[LLM 应用开发实战](/engineering/llm-app-dev)：链式调用、记忆、流式、Function Calling、服务化。
- **产出**：做一个只读资料摘要或结构化抽取小任务；加入无效 JSON、无证据、超时、断流和重复请求的测试。固定一小组开发案例，并另留未用于改提示的验收案例。
- **通过信号**：能追踪“模型说了什么”和“程序接受了什么”的区别；被模型伪造的身份或工具名不能越过服务端授权。先写最小代码基线，再判断框架是否降低维护成本。

## 阶段三：RAG（检索增强，企业最核心）

**目标**：当任务依赖可追溯的外部知识时，能设计、实现并评估检索增强链路。旧标题保留用于兼容；本站未统计它在企业中的优先级或招聘频率，不需要外部证据的任务可不采用 RAG。

- [RAG 基础与流程](/rag/rag-basics) → [Embedding 与向量数据库](/rag/embedding-vectordb) → [RAG 进阶与优化](/rag/rag-advanced)。
- 关键能力：切分策略、Embedding/向量库选型、混合检索、Rerank、RAGAS 评估、引用溯源、增量更新。
- **产出**：构建小知识库并登记文档来源、有效时间、权限和删除状态；留一组回答有唯一可核依据的问题，以及无答案、过期和无权限负例。
- **通过信号**：分别定位证据是否在库、是否召回、是否入上下文及是否被正确引用。增量更新/删除后旧答案不能从缓存复活；RAGAS 或其他裁判分数不能代替这些业务检查。详见 [RAG 生产化](/rag/rag-production)。

## 阶段四：Agent（让模型会「做事」）

**目标**：让不确定子任务在预算和授权内完成；先建立确定性工作流与单 Agent 基线，再判断是否需要多 Agent。

- [Agent 基础与框架](/agent/agent-basics) → [Function Calling 与 MCP](/agent/function-calling-mcp) → [多 Agent 与进阶范式](/agent/multi-agent)。
- 关键能力：ReAct、Plan-and-Execute、Reflexion、工具设计、记忆、LangGraph、AutoGen/CrewAI、可靠性与安全。
- **产出**：只读工具先跑通，再为高风险写动作设计审批与业务幂等；模拟执行成功但回复丢失、审批过期、恢复时权限撤销三种故障。
- **通过信号**：能说明谁决定执行、何时重新核权、什么算任务完成以及何时交人工；checkpoint 保存成功不能证明外部副作用未重复。沿 [持久工作流](/agent/durable-agent-workflows) 和 [工具安全](/agent/tool-safety) 核查。

## 阶段五：工程化（微调 + 部署）

**目标**：本阶段分两条可独立选择的路线，不要求应用开发者同时训练和部署自己的权重。

| 分支 | 先决条件与问题 | 最小验收产物 |
| --- | --- | --- |
| 模型适配 | 固定数据与评估，先证明 Prompt/RAG 基线缺口 | 与基座比较领域、通用和高风险切片，记录训练成本与退化；无硬件可先写实验协议 |
| 服务治理 | 固定负载、SLO 与计费边界 | 请求取消/排队/重试/预算记录；有自托管环境再测显存、goodput 和压测曲线 |

- [微调范式](/finetuning/finetuning) → [LoRA / QLoRA](/finetuning/lora) → [RLHF / DPO](/finetuning/rlhf)。
- [分布式训练与显存优化](/pretraining/distributed-training)、[推理优化与部署](/inference/inference-optimization)、[解码与采样](/basics/decoding)、[MoE](/basics/moe)。
- 关键能力：LoRA/QLoRA 微调、数据构造、LLaMA-Factory、vLLM 部署、量化、性能压测、私有化方案。
- **研究加深**：有 Python、PyTorch、系统与概率线代基础时，可选择 [Stanford CS336 Spring 2025 归档课程](https://stanford-cs336.github.io/spring2025/)。官方前置明确，作业从 tokenizer、模型、优化器延伸到系统与训练；它不是所有 L1 求职者的必修，也不是最新课程声明。沿 [训练内部机制](/advanced/training-internals) 补站内阅读。

## 阶段六：综合 + 求职

- 选一个受控方向做完整闭环，参考 [项目实战案例](/engineering/projects)，写明需求、边界、基线、故障、证据、成本与不足。构造项目、个人练习和真实上线经历分开，不能把教程指标抄进简历。
- 刷 [大模型高频面试题速记](/interview/high-frequency)，针对岗位查漏补缺。
- 关注前沿：[DeepSeek 专题](/models/deepseek)、[经典模型盘点](/models/classic-models)、推理模型、多模态。

## 面试前 4 周冲刺时间表

这是一种可调整的安排，不代表四周足够掌握全站。某阶段缺少可核产物时应缩小目标，而不是为了进度跳过安全或评估。

| 周次 | 任务与可检查产物 |
| --- | --- |
| 第 1 周 | 读一份目标 JD，抽取明确要求与未知项；口述 [速查题](/interview/high-frequency)，只列真实缺口 |
| 第 2 周 | 按目标选择 [代码题](/interview/coding-problems) 与一个项目；保存断言、错误日志和真实计量边界，不只默写 |
| 第 3 周 | 做两次系统设计演练：先问约束，再画链路和恢复分支；题库是练习材料，未核来源不能称招聘真题 |
| 第 4 周 | 模拟追问并修订证据卡：替代方案、一次失败、数据限制、未验证内容；前沿只补与岗位相关部分 |

> 会口述是理解线索，可运行是实现线索；二者都不能代替业务正确、安全和泛化验证。允许暂时“只读”，但把状态写成已阅读/已复算/已运行/真实上线，不能混为一谈。

## 能力里程碑

| 站内层级 | 能力证据，而非毕业/职级标准 |
| --- | --- |
| L0 入门 | 解释 token、证据、隐私和模型能力边界 |
| L1 应用 | 实现一个可核任务，并能定位检索/生成/工具失败 |
| L2 工程 | 在负载、成本、权限和恢复约束中做取舍并留下检查记录 |
| L3 研究 | 给出推导假设、复现实验与同预算对照，说明不确定性 |
| L4 前沿 | 评价贡献、新增证据与可推翻条件，不靠产品发布日期排序 |

## 企业级知识体系对照（L1-L4 + 商业实战）

外部培训可能把 RAG、Agent 或精调叫做 L2/L3/L4；这些名字与 Atlas 的层级不是同一套定义。本表仅按任务组织站内入口，不对培训覆盖、出师标准、就业或商业效果背书。

| 企业体系阶段 | 核心标签 | 本站对应章节 |
| --- | --- | --- |
| 基础与应用契约 | 原理、提示、结构化结果与评估 | [基础](/basics/overview)、[Prompt](/prompt/prompt-engineering)、[应用开发](/engineering/llm-app-dev) |
| 知识与证据生命周期 | 检索、来源、权限、更新与删除 | [RAG](/rag/rag-basics)、[生产化](/rag/rag-production)、[评估](/rag/rag-evaluation) |
| 工具与任务恢复 | 状态、编排、审批、副作用与终止 | [Agent](/agent/agent-basics)、[LangGraph](/engineering/langgraph)、[MCP](/agent/mcp)、[持久工作流](/agent/durable-agent-workflows) |
| 适配与服务治理 | 微调评估、推理容量、运行成本与回滚 | [微调](/finetuning/finetuning)、[量化](/inference/quantization)、[推理框架](/inference/serving-frameworks)、[LLMOps](/engineering/llmops) |
| **商业实战**：综合项目精研 | 商业价值驱动、打通技术与业务、架构选型权衡 | [商业落地与价值评估](/engineering/llm-business)、[AI 系统设计](/engineering/system-design)、[项目实战案例](/engineering/projects)、[2026 岗位能力地图](/interview/job-market-2026) |

<details>
<summary>自测：后端经验很强，要不要先把全部微调课程学完？</summary>

如果目标是企业知识检索应用，先确认是否能处理证据、权限、删除和回归；缺口不能靠学会 LoRA 补上。若目标是领域模型适配，再补数据与训练实验。先为目标任务建立基线，用结果决定下一阶段，而不是让岗位标签或培训进度替你判定掌握度。

</details>

## 阅读来源与使用边界

上述路线是本站的学习建议，不是教育效果实验。实读了 PyTorch 入门页的前置/工作流说明和 CS336 2025 归档的前置/作业概览；没有运行全部课程，也不核证课程收费、当前招录或培训机构宣传。外部资料访问失败时回到站内解释与公开原论文，不把未读链接当完成证据。

> 学习资源清单见 [学习资源汇总](/interview/resources)。
