# 大模型学习路线

> 给想系统入门大模型的同学一条清晰路径。无论你是算法、应用还是后端工程师转型，都能按这条线由浅入深。每个阶段都标注了本站对应的章节。

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

## 能力里程碑

| 阶段 | 能做什么 |
| --- | --- |
| 入门 | 调用各家 API、写高质量 Prompt、用框架搭基础应用 |
| 进阶 | 独立设计实现并评估 RAG 系统、构建向量搜索 |
| 高级 | 设计 Agent 系统、微调模型、私有化部署 |
| 资深 | 承担 AI 基础设施建设、技术选型与架构决策 |

> 学习资源清单见 [学习资源汇总](/interview/resources)。
