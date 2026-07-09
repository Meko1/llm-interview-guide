# 2026 大模型岗位能力地图

> 这页把招聘 JD 里的关键词翻译成求职准备清单。目标不是罗列技术名词，而是帮你判断：目标岗位到底在招什么人、面试会怎么追问、项目该怎么讲。

参考 2026 年大模型应用、Agent、RAG/Memory、Java AI、AI Infra 相关 JD，可以看到一个明显变化：企业不只要会调 API 的人，而是要能把 **LLM 能力接进业务、跑稳、评估、降本、可维护** 的工程师。

如果你想按“从课程知识到项目实战”的顺序准备，可以先看 [大模型应用实战知识体系](/interview/application-practice-roadmap)，再回到本页按岗位方向查漏补缺。

![2026 大模型岗位能力地图：LLM 应用开发、Agent 工程、RAG & Memory、Java AI 工程、AI Infra](/diagrams/job-market-2026.svg)

## 招聘信号速读

| JD 高频词 | 面试官真正想确认什么 | 对应站内补课 |
| --- | --- | --- |
| Prompt Engineering、结构化输出、Function Calling | 你能否把不稳定的模型输出变成可被程序消费的接口 | [Prompt 工程](../prompt/prompt-engineering)、[结构化输出](../engineering/structured-output)、[Function Calling 与 MCP](../agent/function-calling-mcp) |
| RAG、Embedding、向量库、Rerank、知识库 | 你能否做企业知识问答，并定位召回差、幻觉、权限、更新问题 | [RAG 基础](../rag/rag-basics)、[切分与检索](../rag/chunking-retrieval)、[RAG 生产化](../rag/rag-production) |
| Agent、Workflow、Tool Calling、Memory、MCP | 你能否设计可控的任务执行系统，而不是只写一个聊天 Demo | [Agent 基础](../agent/agent-basics)、[AI 工作流 vs Agent](../agent/workflow)、[Agent 记忆](../agent/agent-memory)、[MCP](../agent/mcp) |
| Java、Spring Boot、Spring AI、MyBatis、MQ、MySQL | 你能否把 AI 能力接入已有后端系统和企业工程栈 | [LLM 应用开发实战](../engineering/llm-app-dev)、[AI 系统设计](../engineering/system-design) |
| vLLM、Ollama、SGLang、TensorRT-LLM、KV Cache、CUDA | 你是否理解推理服务的延迟、吞吐、显存、并发调度 | [推理优化](../inference/inference-optimization)、[GPU 与硬件基础](../inference/gpu-hardware) |
| LoRA/QLoRA、SFT、DPO/RLHF、数据清洗 | 你是否能判断什么时候微调、怎么构造数据、如何评估收益 | [微调范式](../finetuning/finetuning)、[LoRA](../finetuning/lora)、[RLHF/DPO](../finetuning/rlhf) |
| LangChain、LlamaIndex、LangGraph、AutoGen、CrewAI | 你是否理解框架背后的抽象，而不是只会复制模板 | [LangChain 与应用框架](../engineering/langchain)、[多 Agent](../agent/multi-agent) |
| Claude Code、Cursor、Codex、Trae、AI Coding | 你是否能用 AI 工具稳定交付代码，而不是只会生成 demo | [AI 编程工具实战](../engineering/ai-coding-tools)、[AI 编程与 Coding Agent](../engineering/coding-agent) |
| 评估、可观测、成本、安全合规 | 你能否让系统上线后可诊断、可迭代、可控风险 | [模型评估](../evaluation/evaluation)、[Agent 评估](../agent/agent-evaluation)、[大模型安全](../advanced/safety) |

## 五类岗位能力矩阵

| 岗位方向 | 核心产出 | 必备能力 | 加分能力 | 项目证据 |
| --- | --- | --- | --- | --- |
| LLM 应用开发 | 把模型能力封装成业务可用功能 | API 接入、Prompt、结构化输出、流式输出、Function Calling、成本控制 | 多模型路由、Batch API、Prompt 缓存、灰度与监控 | 客服助手、办公助手、智能问答、报告生成 |
| Agent 工程 | 让模型安全调用工具并完成多步骤任务 | Tool Calling、工作流编排、状态管理、失败重试、权限边界 | MCP、多 Agent、DSL、Agent 评估、可观测 | 投研助手、运营 Agent、代码 Agent、流程自动化 |
| RAG & Memory | 构建可检索、可更新、可追溯的知识底座 | 文档解析、Chunk、Embedding、向量库、混合检索、Rerank、引用溯源 | Agent Memory、GraphRAG、多模态索引、权限隔离 | 企业知识库、金融知识库、客服知识库 |
| Java AI 工程 | 在企业后端栈中落地 AI 功能 | Java/Spring Boot、Spring AI、MySQL/Redis/MQ、SSE、微服务 | Python 桥接、向量库、模型网关、Java Agent 工程化 | 银行/客服/零售系统中的 AI 模块 |
| AI Infra | 提供模型训练、推理和平台化能力 | vLLM/SGLang/Ollama、CUDA 基础、KV Cache、量化、Docker/K8s | TensorRT-LLM、推理调度、多租户、成本核算、边缘部署 | 模型服务平台、私有化部署、推理压测平台 |

判断自己适合哪条线，不看标题，看你能交付什么：

- 能把业务流程拆成模型调用、工具调用、数据读写：优先投 LLM 应用开发 / Java AI。
- 能解释 Agent 什么时候不该用、怎么失败恢复、怎么评估：投 Agent 工程。
- 能把“召回不准”拆成数据、切分、检索、重排、生成问题：投 RAG & Memory。
- 能讲 TTFT、TPOT、KV Cache、批处理、量化和部署成本：投 AI Infra。

## LLM 应用开发岗

JD 常见画像：大模型算法应用工程师、大模型应用开发、AI 应用研发。薪资区间跨度大，但面试重点很稳定：**能不能把模型变成稳定服务**。

### 能力拆解

| 层级 | 你要会什么 | 面试常问 |
| --- | --- | --- |
| 模型接入 | OpenAI/Claude/Qwen/DeepSeek 等 API，多模型网关，超时重试 | 上游模型超时、限流、返回格式变了怎么办 |
| 交互体验 | 流式输出、上下文管理、多轮会话、前后端协议 | SSE 和 WebSocket 怎么选，流式下怎么处理错误 |
| 输出可靠性 | JSON Mode、Schema 约束、解析失败重试、内容审核 | 怎么让模型稳定返回结构化 JSON |
| 工具调用 | Function Calling、工具 Schema、参数校验、执行回传 | 模型会不会自己执行函数，工具调用失败怎么办 |
| 成本与性能 | 模型分级、缓存、Prompt 压缩、限流、Batch | 为什么 output token 更贵，怎么降本 |
| 评估闭环 | 评测集、bad case 归因、线上日志、A/B | 你怎么证明效果提升，不靠感觉 |

### 面试追问

1. 你接入过哪些模型？如果同一个 prompt 在不同模型上表现不一致，怎么做路由和 fallback？
2. 结构化输出失败时，你是重试、修复 JSON、还是换成约束解码？各自代价是什么？
3. 流式输出已经开始返回，后端中途报错，前端体验和日志怎么设计？
4. Function Calling 的工具描述怎么写？参数校验放在模型侧还是代码侧？
5. Prompt 缓存、语义缓存、结果缓存分别适合什么场景？
6. 一个客服助手回答准确率从 70% 到 85%，你怎么拆指标证明是检索、Prompt 还是模型带来的提升？

### 项目讲法

不要说“我用 LangChain 做了一个助手”。改成：

> 我做的是一个面向客服/运营/投研的 LLM 应用服务。链路是用户请求进入后先做意图识别和安全过滤，再按任务复杂度路由到不同模型；需要业务数据时通过 Function Calling 查库或调用内部 API；输出用 Schema 约束，前端通过 SSE 返回。上线后重点优化了 3 个指标：首 token 延迟、结构化输出成功率、单次请求成本。

可量化指标：

- 首 token 延迟从多少秒降到多少秒，靠流式、模型路由、Prompt 缓存还是并发优化。
- JSON 解析成功率、工具调用成功率、人工接管率。
- 平均 token 成本、缓存命中率、超时率。

## Agent 工程岗

JD 常见画像：AI Agent 应用开发工程师、Agent 智能体大模型应用开发、AI 平台 Agent 能力建设。招聘要求里会同时出现 Tool Calling、Memory、Workflow、MCP、LangGraph、AutoGen、CrewAI、DSL。

### 能力拆解

| 能力 | 准备重点 | 易踩坑 |
| --- | --- | --- |
| 任务规划 | ReAct、Plan-and-Execute、工作流和 Agent 的边界 | 把所有流程都交给模型自由规划，稳定性差 |
| 工具设计 | 工具粒度、JSON Schema、权限、幂等、超时 | 工具太粗不可控，太细会增加规划难度 |
| 状态与记忆 | 短期状态、长期记忆、检索注入、冲突更新 | 把全量历史塞上下文，成本高且噪声大 |
| 失败恢复 | 限步数、重试、回滚、人工确认、降级路径 | 没有终止条件，Agent 循环调用工具 |
| 可观测 | LangSmith/LangFuse、工具调用轨迹、成本日志 | 只看最终回答，不看中间决策 |
| 安全边界 | 最小权限、敏感操作确认、Prompt 注入防护 | RAG 文档或网页内容劫持工具调用 |

### 面试追问

1. 什么时候用固定 Workflow，什么时候用 Agent？怎么向业务解释这个取舍？
2. Agent 规划错了怎么纠正？靠 prompt、反思、验证器还是人工确认？
3. 工具调用失败有哪些类型：参数错、权限错、网络错、业务失败、模型误调用。分别怎么处理？
4. Memory 写入策略怎么设计？什么该记、什么不该记，冲突记忆怎么更新？
5. MCP 解决了什么问题？Host、Client、Server 分别是什么？
6. 多 Agent 比单 Agent 强在哪里？误差累积和协调成本怎么控制？
7. 如何评估 Agent？只看任务成功率够不够，还要看哪些过程指标？

### 项目讲法

Agent 项目的关键不是“用了几个智能体”，而是讲清 **可控性**：

> 我把任务拆成规划、执行、验证三个阶段。规划阶段只输出结构化计划；执行阶段的工具都有 Schema、权限和超时；验证阶段用规则和 LLM Judge 双层检查。对于高风险动作，比如写库、发消息、下单，必须人工确认。线上记录每一步工具调用、token、耗时和失败原因，用于回放 bad case。

加分细节：

- 能说明为什么部分流程用确定性工作流，而不是完全开放 Agent。
- 能讲出失败模式：死循环、上下文污染、工具幻觉、权限越界、长任务状态丢失。
- 能有实际上线经验，而不是只跑过 demo。

## RAG & Memory 岗

JD 常见画像：AI 搜索及大模型应用开发、RAG 系统开发、智能信息底座、AI Memory。核心是 **知识与记忆底座**，不是简单“向量库 + prompt”。

### 能力拆解

| 环节 | 准备重点 | 面试常问 |
| --- | --- | --- |
| 数据接入 | PDF/网页/图片/表格解析，清洗去重，元数据 | 文档格式复杂、表格丢结构怎么办 |
| 切分策略 | 固定窗口、标题层级、父子分块、语义切分 | chunk size 怎么定，overlap 是否越大越好 |
| 检索 | Embedding、向量库、BM25、混合检索、过滤 | 向量召回和关键词召回各解决什么 |
| 重排 | Cross-encoder、Rerank、上下文压缩 | 为什么不能直接把 Top-K 全塞给模型 |
| 生成 | 引用溯源、拒答、事实约束、答案格式 | 如何降低幻觉，如何处理“资料里没有” |
| 更新与权限 | 增量 upsert、删除、版本、租户隔离、ACL | 用户只能看部分文档，检索怎么隔离 |
| Memory | 事实抽取、写入、检索、冲突解决、遗忘 | Memory 和 RAG 的区别是什么 |
| 评估 | Hit Rate、MRR、Faithfulness、线上反馈 | 召回问题和生成问题怎么分开定位 |

### 面试追问

1. RAG 回答错了，你怎么判断是检索没召回、召回了但没用、还是模型编了？
2. 混合检索怎么融合？RRF、加权分数、规则过滤分别适合什么场景？
3. HNSW、IVF、pgvector、Milvus、ES 怎么选？小规模和大规模选型有什么不同？
4. 金融/客服知识库要求可靠，如何做引用溯源、拒答和人工兜底？
5. Agent Memory 写入时如何避免把错误信息长期记住？
6. 多模态知识库中图片、网页、表格怎么索引？什么时候需要多模态 Embedding？
7. RAG 和长上下文怎么选？什么时候直接塞长上下文更划算？

### 项目讲法

一个 RAG 项目要讲成“可迭代系统”：

> 我们把 RAG 拆成离线索引和在线问答两条链路。离线链路负责解析、切分、Embedding、元数据和权限入库；在线链路负责 query 改写、混合检索、Rerank、上下文拼接和带引用回答。排查 bad case 时先看检索 Top-K 是否命中，再看重排顺序、上下文长度、Prompt 约束和模型忠实度。

可量化指标：

- 检索命中率、MRR、Top-K 覆盖率。
- 答案忠实度、引用准确率、拒答准确率。
- 增量更新延迟、索引成本、查询 P95 延迟。

## Java AI 工程岗

JD 常见画像：资深 Java 开发工程师、大模型应用开发工程师、银行项目研发、客服大模型。它不是“Java 写模型”，而是 **用 Java 工程栈承接 AI 落地**。

### 能力拆解

| 能力 | 准备重点 | 面试常问 |
| --- | --- | --- |
| 后端基础 | Spring Boot、Spring Cloud、MyBatis、MySQL、Redis、MQ | 大模型调用很慢，接口线程会不会被拖死 |
| AI 接入 | Spring AI、LangChain4j、OpenAI 兼容接口、SSE | Java 服务怎么做流式输出 |
| 业务集成 | 权限、审计、日志、业务 API、工作流 | AI 怎么接已有 CRM/客服/银行系统 |
| RAG 工程 | 文档解析、向量库、ES/PGVector/Milvus、权限过滤 | 文档权限和用户权限如何绑定 |
| Agent 工程 | Skills、Tool、Function Calling、Memory | Java 后端如何执行工具调用 |
| 可靠性 | 超时、重试、限流、降级、内容安全 | 上游模型不可用时怎么兜底 |

### 面试追问

1. Spring AI 或 LangChain4j 相比自己封装 HTTP，有什么收益和代价？
2. SSE 在 Spring Boot 里怎么实现？连接断开、超时、异常怎么处理？
3. 银行/客服场景为什么特别强调审计、权限和安全合规？
4. AI 调用第三方模型慢且贵，Java 服务如何做线程池、异步、限流和队列？
5. MySQL/ES/PGVector/Milvus 在知识库场景里怎么组合？
6. 你怎么把 Prompt、工具描述、模型配置做成可灰度、可回滚的配置？

### 项目讲法

Java AI 项目要把“AI 能力”讲回企业工程：

> 我负责把大模型能力接入已有 Java 微服务。AI 层提供统一模型网关、Prompt 模板、RAG 检索和工具调用；业务层通过标准接口调用，不直接依赖具体模型。为了可上线，做了 SSE 流式返回、用户级限流、审计日志、异常降级和配置化模型路由。

加分细节：

- 能说清 Java 与 Python 的分工：Java 承接业务和服务治理，Python 可承接模型训练、数据处理或推理实验。
- 能解释为什么银行/客服项目更看重权限、审计、稳定性，而不是炫技。
- 能把 AI 工程和原有微服务治理、消息队列、数据库事务联系起来。

## AI Infra 岗

JD 常见画像：大模型应用开发但要求 vLLM/CUDA/K8s、AI Infra、边缘 AI、模型部署与优化。重点是 **让模型服务更快、更便宜、更稳定**。

### 能力拆解

| 能力 | 准备重点 | 面试常问 |
| --- | --- | --- |
| 推理基础 | Prefill/Decode、TTFT/TPOT、吞吐、KV Cache | 为什么 decode 是 memory-bound |
| 推理框架 | vLLM、SGLang、TensorRT-LLM、Ollama、Llama.cpp | PagedAttention 和连续批处理解决什么 |
| 显存优化 | 量化、GQA/MQA/MLA、KV 量化、上下文裁剪 | 长上下文为什么贵，怎么省 KV Cache |
| 部署运维 | Docker、K8s、GPU 调度、监控告警、多副本 | 模型服务怎么高可用，怎么扩容 |
| 成本优化 | 模型分级、缓存、批处理、限流、压测 | 如何用数据证明降本没有伤效果 |
| 训练/微调 | LoRA/QLoRA、SFT、Deepspeed、数据构造 | 微调和 RAG 什么时候各自更合适 |

### 面试追问

1. Prefill 和 Decode 的瓶颈分别是什么？为什么 TTFT 和 TPOT 优化方向不同？
2. KV Cache 显存如何估算？长上下文服务为什么容易爆显存？
3. vLLM 的 PagedAttention 和连续批处理分别解决什么问题？
4. GPTQ、AWQ、GGUF、INT8/INT4 怎么选？量化掉点怎么评估？
5. 私有化部署时如何选模型、显卡、并发策略和容灾方案？
6. 模型服务 P95 延迟突然上升，你怎么定位是排队、prefill、decode、网络还是上游存储？
7. 边缘设备上部署模型，和云端 GPU 部署最大的约束差异是什么？

### 项目讲法

Infra 项目讲指标和压测：

> 我负责模型服务平台的推理优化和部署。先用压测拆分 TTFT、TPOT、吞吐和显存占用，再根据业务请求长度和并发特征选择 vLLM/SGLang/Ollama。优化手段包括量化、批处理、模型分级、KV Cache 管理、限流排队和多副本部署。上线后用 P50/P95 延迟、GPU 利用率、错误率和单次请求成本持续监控。

可量化指标：

- QPS、吞吐 tokens/s、P95 延迟、GPU 显存占用。
- 每千次请求成本、缓存命中率、降级比例。
- 单机并发上限、扩容速度、故障恢复时间。

## 面试题怎么从 JD 里长出来

拿到一个 JD，按下面方式拆：

| JD 句子 | 翻译成能力 | 面试追问 |
| --- | --- | --- |
| “优化 Prompt 和智能体机制，提升专业性与可靠性” | Prompt 约束、工具调用、评估、失败恢复 | 你怎么证明可靠性变好了？有哪些 bad case？ |
| “构建结构化知识库，适配大模型与智能体” | RAG、元数据、权限、Memory | 知识库更新、删除、权限隔离怎么做？ |
| “落地 Function Call、RAG、MCP 核心能力” | 工具协议、检索链路、标准化集成 | MCP 比普通 HTTP 工具调用多解决什么？ |
| “负责模型推理性能优化，包括 KV Cache、显存优化、并发调度” | 推理框架、显存估算、调度 | 长上下文 + 高并发下怎么避免 OOM？ |
| “熟悉 Java、Spring AI、LLM 框架、SSE” | 企业后端 AI 集成 | 大模型调用慢，Java 接口怎么设计不阻塞？ |

## 基础篇技能怎么补

如果 JD 同时出现 Spring AI、LangChain、LangGraph、Dify、RAG、Function Calling、LoRA、DPO、MaaS、Agent 评测这些词，不要按词孤立背。先走一遍 [大模型基础篇岗位要求总纲](./foundation-requirements)，把它们归到 12 类能力里：

- **应用接入**：Spring AI、LangChain、结构化输出、SSE。
- **任务编排**：Workflow、LangGraph、Agent、Function Calling、MCP。
- **知识增强**：RAG、Memory、Dify Knowledge、权限过滤。
- **模型适配**：SFT、PEFT、LoRA、QLoRA、RLHF、DPO。
- **平台治理**：MaaS、模型网关、评估、成本、安全合规。

准备顺序建议是：先补基础篇词表，再准备系统设计。基础篇让你能答“这是什么、怎么用、和谁对比”；系统设计让你能答“如何上线、如何治理、如何评估”。

准备时不要只背定义。每个能力点都准备一段“真实排障”：

1. 现象：线上出现了什么问题。
2. 定位：你怎么判断根因。
3. 方案：你比较了哪些做法，为什么选这个。
4. 指标：优化前后有什么变化。
5. 反思：还有什么限制，下一步怎么做。

## 系统设计必会清单

系统设计是 2026 大模型岗位的分水岭：能把知识点讲成生产系统，才像真正做过。至少准备这 5 类题：

| 题型 | 必须讲清 | 对应补课 |
| --- | --- | --- |
| 企业知识库 RAG | 离线索引、在线检索、权限过滤、引用溯源、评估闭环 | [AI 系统设计专题](../engineering/system-design) / [RAG 生产化](../rag/rag-production) |
| Agent 任务平台 | 工具注册、状态管理、失败恢复、人工确认、轨迹评估 | [Agent 评估](../agent/agent-evaluation) |
| 模型网关 | 虚拟 Key、RPM/TPM、模型路由、failover、计费审计 | [模型网关与多模型路由](../engineering/llm-gateway) |
| 推理服务平台 | TTFT/TPOT、连续批处理、KV Cache、量化、GPU 调度 | [推理性能压测](../inference/inference-benchmark) |
| AI Coding 平台 | 上下文索引、权限边界、review gate、测试门禁、回滚 | [AI 编程工具实战](../engineering/ai-coding-tools) |

准备每类题时都按八段式回答：需求、规模、指标、主链路、数据流、可靠性、评估、演进。不要只画组件，要讲权衡和失败预案。

## 4 周冲刺路线

| 周次 | 目标 | 每天要做什么 | 产出物 |
| --- | --- | --- | --- |
| 第 1 周 | 补齐共同底座 | 复习 [高频题](./high-frequency) 的 Prompt/RAG/Agent/推理部分；每天手写 3 个核心流程图 | 一页个人能力雷达图，标出弱项 |
| 第 2 周 | 按岗位深挖 | 目标 LLM 应用/Java 就刷结构化输出、流式、Function Calling；目标 RAG 就刷切分、检索、评估；目标 Infra 就刷推理优化 | 每条岗位线 20 个追问的口头答案 |
| 第 3 周 | 重写项目讲法 | 把简历项目改成“背景-架构-难点-指标-反思”；补 2 个系统设计题 | 2 个能讲 8 分钟的项目故事 |
| 第 4 周 | 模拟追问和补短板 | 每天做 1 次 30 分钟模拟面试；专攻答不清的链路和指标 | 一份面试前速查稿，含指标、链接、追问 |

不同背景的优先级：

| 背景 | 第一优先级 | 第二优先级 | 不要一开始死磕 |
| --- | --- | --- | --- |
| Java/后端 | LLM 应用开发、Java AI、RAG 生产化 | Agent 工具调用、SSE、限流降级 | 从零训练大模型 |
| 算法/研究 | 微调、推理优化、评估 | 工程服务化、RAG、Agent | 只讲论文不讲上线 |
| 数据/搜索 | RAG、AI Search、Memory | Text-to-SQL、GraphRAG、多模态索引 | 只讲向量库 API |
| 前端/全栈 | LLM 应用体验、流式、Agent UI | 结构化输出、工具调用、可观测 | 只做页面不讲模型链路 |
| AI Coding 转型 | AI 编程工具、Spec Coding、测试与 review | 代码 Agent、工程规范、项目交付证据 | 只展示一键生成 demo |

## 简历项目检查清单

投 2026 大模型岗位前，检查你的项目是否能回答这些问题：

- **业务目标**：解决了谁的什么问题，不是“学习项目”。
- **完整链路**：用户输入到最终输出的每一步你都能画出来。
- **技术取舍**：为什么用 RAG/Agent/微调/长上下文，而不是另一个方案。
- **可靠性**：失败怎么处理，能否拒答、降级、人工确认。
- **评估指标**：准确率、召回率、忠实度、延迟、成本至少有 2 个。
- **上线意识**：日志、监控、权限、配置、灰度、安全。
- **个人贡献**：你亲自做了哪个关键决策，踩过什么坑。

如果项目只能讲“调用 API 生成回答”，面试会很快被追问打穿。把它升级为“可上线系统”：加评估集、加日志、加失败处理、加权限、加成本指标，哪怕规模不大，也比功能堆砌更像真实岗位。

## 继续刷题

- 按岗位刷题：[分岗位面试真题](./real-questions)
- 先过一遍高频卡片：[高频面试题速记](./high-frequency)
- 准备项目讲法：[AI 项目实战案例](../engineering/projects)
- 补学习路线：[大模型学习路线](./learning-path)
