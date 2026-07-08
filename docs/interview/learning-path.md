# 大模型学习路线

> 给想系统入门大模型的同学一条清晰路径。无论你是算法、应用还是后端工程师转型，都能按这条线由浅入深。每个阶段都标注了本站对应的章节。

## 按背景选择你的起点

| 你的背景 | 可以跳过 | 重点投入 | 预计周期 |
| --- | --- | --- | --- |
| 后端/Java 工程师 | 工程化常识 | 阶段一理论 + 阶段三 RAG + 阶段四 Agent（最快变现的转型路径） | 3~6 个月业余时间 |
| 应届/在校生 | — | 全链路走完；阶段一打牢（面试爱考原理），项目要有完整闭环 | 6~12 个月 |
| 算法/研究背景 | 阶段一大部分 | 阶段五微调对齐 + [前沿专题](/advanced/reasoning-models)，深挖训练与 RL | 2~4 个月补工程 |
| 产品/零基础转行 | — | 先走 [零基础入门](/beginner/getting-started)，再从阶段二应用层切入 | 视投入而定 |

## 你需要补什么？

如果你已有编程/工程基础（尤其是后端工程师），转型大模型主要补三块：

1. **AI 基础理论**：神经网络、Transformer、Attention、Embedding。
2. **Python 与 AI 生态**：Python、NumPy/Pandas、HuggingFace、PyTorch（用到再深入）。
3. **大模型特有范式**：Prompt Engineering、RAG、Agent、微调、推理部署。

> 工程经验（系统设计、API、数据处理、调试、高并发）是你的优势——大模型落地本质还是工程。

## 阶段一：地基（理论 + 调通 API）

**目标**：理解大模型「为什么能说话」，能熟练调用各家 API。

- 神经网络与 Transformer 基础：看 [Transformer 架构](/basics/transformer)、[Attention 与变体](/basics/attention)、[位置编码](/basics/position-encoding)、[Tokenizer](/basics/tokenizer)。
- 推荐补充：3Blue1Brown 神经网络系列、李沐《动手学深度学习》、《Attention Is All You Need》（读懂架构图）。
- 实操：调通 OpenAI / Claude / 通义千问等 API，理解 Token、上下文窗口、流式输出、多轮对话。

## 阶段二：应用（Prompt + 框架 + 第一个项目）

**目标**：能用 Prompt 和框架搭出可用的 LLM 应用。

- [Prompt 工程](/prompt/prompt-engineering)：Zero/Few-shot、CoT、ReAct、结构化输出、注入防护。
- [LangChain 与应用开发框架](/engineering/langchain)、[LLM 应用开发实战](/engineering/llm-app-dev)：链式调用、记忆、流式、Function Calling、服务化。
- 推荐课程：吴恩达《ChatGPT Prompt Engineering for Developers》《LangChain for LLM Application Development》（DeepLearning.AI，免费）。
- 实操：做一个带多轮对话、流式输出的 AI 助手并服务化。

## 阶段三：RAG（检索增强，企业最核心）

**目标**：能独立设计、实现、评估一个 RAG 系统。这是企业 AI 落地最高频的能力。

- [RAG 基础与流程](/rag/rag-basics) → [Embedding 与向量数据库](/rag/embedding-vectordb) → [RAG 进阶与优化](/rag/rag-advanced)。
- 关键能力：切分策略、Embedding/向量库选型、混合检索、Rerank、RAGAS 评估、引用溯源、增量更新。
- 推荐：吴恩达《Building and Evaluating Advanced RAG》；研究开源产品 Dify、FastGPT 的实现。
- 实操：构建一个企业知识库问答系统。

## 阶段四：Agent（让模型会「做事」）

**目标**：能设计单 Agent 与多 Agent 系统。

- [Agent 基础与框架](/agent/agent-basics) → [Function Calling 与 MCP](/agent/function-calling-mcp) → [多 Agent 与进阶范式](/agent/multi-agent)。
- 关键能力：ReAct、Plan-and-Execute、Reflexion、工具设计、记忆、LangGraph、AutoGen/CrewAI、可靠性与安全。
- 推荐：吴恩达《AI Agents in LangGraph》；Lilian Weng 的 Agent 博客。

## 阶段五：工程化（微调 + 部署）

**目标**：能微调开源模型并部署成服务。

- [微调范式](/finetuning/finetuning) → [LoRA / QLoRA](/finetuning/lora) → [RLHF / DPO](/finetuning/rlhf)。
- [分布式训练与显存优化](/pretraining/distributed-training)、[推理优化与部署](/inference/inference-optimization)、[解码与采样](/basics/decoding)、[MoE](/basics/moe)。
- 关键能力：LoRA/QLoRA 微调、数据构造、LLaMA-Factory、vLLM 部署、量化、性能压测、私有化方案。
- 推荐：吴恩达《Finetuning Large Language Models》；LLaMA-Factory；vLLM 文档。

## 阶段六：综合 + 求职

- 选一个方向做完整项目（企业 AI 助手 / AI 代码助手 / 智能数据分析），参考 [AI 项目实战案例](/engineering/projects) 的架构与面试讲法，写好 README 和技术博客。
- 刷 [大模型高频面试题速记](/interview/high-frequency)，针对岗位查漏补缺。
- 关注前沿：[DeepSeek 专题](/models/deepseek)、[经典模型盘点](/models/classic-models)、推理模型、多模态。

## 面试前 4 周冲刺时间表

| 周次 | 任务 |
| --- | --- |
| 第 1 周 | 过一遍 [高频面试题速记](/interview/high-frequency)，标记答不上来的题，回到对应详解页补 |
| 第 2 周 | 主攻 [手撕代码题解集](/interview/coding-problems)：每道题默写一遍；复习自己简历项目的技术细节与量化指标 |
| 第 3 周 | 按目标岗位刷 [分岗位真题](/interview/real-questions)；准备 2~3 个系统设计题的完整答案（RAG 系统/高并发服务） |
| 第 4 周 | 模拟面试（讲项目 + 追问），补前沿话题（[DeepSeek](/models/deepseek)/[推理模型](/advanced/reasoning-models)），查缺补漏 |

> 每个阶段的检验标准：**能不看资料给别人讲明白 + 能写出可运行的最小实现**。只看不练 = 没学。

## 能力里程碑

| 阶段 | 能做什么 |
| --- | --- |
| 入门 | 调用各家 API、写高质量 Prompt、用框架搭基础应用 |
| 进阶 | 独立设计实现并评估 RAG 系统、构建向量搜索 |
| 高级 | 设计 Agent 系统、微调模型、私有化部署 |
| 资深 | 承担 AI 基础设施建设、技术选型与架构决策 |

## 企业级知识体系对照（L1-L4 + 商业实战）

市面上的企业级大模型实战培训（如智泊AI 等机构的知识体系）普遍采用「L1 基础认知 → L2 RAG → L3 Agent → L4 精调部署 → 商业实战」五阶段结构。本站内容对这套体系全覆盖，按阶段索引如下，可作为对照自查表：

| 企业体系阶段 | 核心标签 | 本站对应章节 |
| --- | --- | --- |
| **L1 基础认知破局**：核心原理与提示工程 | 破除技术黑箱、提示词工程、商业全景 | [大模型基础](/basics/overview)（11+ 页）、[Prompt 工程](/prompt/prompt-engineering)（6 页）、[大模型商业落地与价值评估](/engineering/llm-business) |
| **L2 RAG 引擎构建**：企业级私有知识库 | 端到端搭建、性能诊断调优、私有数据 | [RAG 基础](/rag/rag-basics) → [生产化与系统设计](/rag/rag-production) → [评估（RAGAS）](/rag/rag-evaluation) 全链路 10+ 页 |
| **L3 Agent 架构设计**：自主决策 AI 助手 | LangGraph 图状智能体、多智能体（MAS）、通信协议、复杂工作流 | [Agent 基础](/agent/agent-basics)、[LangGraph 深入](/engineering/langgraph)、[多 Agent](/agent/multi-agent)、[MCP](/agent/mcp) / [A2A 协议](/agent/a2a-protocol)、[工作流 vs Agent](/agent/workflow)、[评估与可靠性](/agent/agent-evaluation) |
| **L4 模型精调与部署**：专属化模型服务 | 全流程微调、量化压缩、分布式推理、运维监控、垂直领域专家模型 | [微调范式](/finetuning/finetuning)、[LoRA](/finetuning/lora)、[量化实战](/inference/quantization)、[推理框架](/inference/serving-frameworks)、[LLMOps](/engineering/llmops)、[垂直领域专家模型实战](/finetuning/domain-expert-model) |
| **商业实战**：综合项目精研 | 商业价值驱动、打通技术与业务、架构选型权衡 | [商业落地与价值评估](/engineering/llm-business)、[AI 系统设计](/engineering/system-design)、[项目实战案例](/engineering/projects)、[2026 岗位能力地图](/interview/job-market-2026) |

> 用法：面试前按此表逐阶段自查——每个阶段能不能脱稿讲出「核心问题、技术方案、生产化要点、业务价值」四层，即达到企业培训体系的出师标准。

> 学习资源清单见 [学习资源汇总](/interview/resources)。
